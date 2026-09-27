"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BRAND_LOGO } from "@/components/Brand";

/* ------------------------------------------------------------------
   Hero — the official ATecHS seal hanging from a lanyard.

   Real 3D (three.js), no physics library, no React re-renders per frame.

   Object : the canonical seal (BRAND_LOGO) printed on a thin disc that
            is gripped by the swivel clasp — the seal itself is what you grab.
   Lanyard: a flat woven ATecHS ID lace — the real design from the
            reference photo: navy webbing with a white school panel, gold
            chevrons, gold/white core-values type and a printed seal on the
            front face; the back face is plain black fabric. Front and back
            are separate skins with real thickness between them, so the lace
            shows black when it twists, never a wrapped-around print.
            It leaves the top of the canvas: on the 2-column desktop hero
            the canvas is grown upward so its top edge sits at the top of
            the page (the hero clips it), and the lace's alpha fades out
            underneath the nav band — so no endpoint, loop or hook is ever
            visible. It ends below in a folded end tab -> D-ring -> clasp.
   Physics: two coordinates integrated in rAF —
              theta — swing angle about the off-screen anchor
              L     — rope length (springs back to L0) so pulling the
                      seal up/down works like a shortened lanyard
            pointerdown on the seal springs (theta, L) toward the pointer
            with resistance; release keeps omega/vL, so the seal swings
            back with the drag's velocity, overshoots subtly and settles.
            The lace is re-fitted every frame from the anchor to the tab,
            including a twist that reacts to the swing.
   Reduced motion: overdamped follow — grabbing still works, no free swing.
   ------------------------------------------------------------------ */

const LOGO_SRC = BRAND_LOGO; /* canonical asset — see src/components/Brand.tsx */

/* ---------- framing, relative to the LAYOUT BOX (never changes) ----------
   The box shows BOX_UNITS world units of height whatever its pixel
   height, so the seal keeps the same size and place at every breakpoint. */
const BOX_UNITS = 6;
const BOX_BOTTOM = -3.915; /* world y at the bottom edge of the box */
const TOP_Y = BOX_BOTTOM + BOX_UNITS; /* 2.075 — top edge of the box */
const BOT_Y = BOX_BOTTOM; /* drag clamp */
const REST_Y = -2.3; /* seal centre at rest, measured from the box */
const CAM_Z = 9.5;
const TWO_COL_QUERY = "(min-width: 1024px)"; /* hero grid: 2 columns here */

/* Anchor sits above the top edge of the canvas (never on screen). */
const ANCHOR = new THREE.Vector3(0, 2.7, 0);

/* ---------- seal proportions (measured: art = 0.9524 of half the square) ---------- */
const TEX_SPAN = 2.3; /* world size of the full 2048² texture */
const R_GEO = TEX_SPAN / 2; /* face geometry radius (samples the whole texture) */
const R_ART = R_GEO * 0.9524; /* printed seal radius */
const BACK_R = R_ART * 1.015; /* backing disc -> a hair of visible edge/thickness */
const THICK = 0.09;
/* ---------- connector: swivel clasp -> D-ring -> printed end tab ----------
   Everything stacks above the seal's top edge (R_ART); the lace itself
   ends hidden inside the folded tab. */
const JAW_W = 0.22;
const JAW_H = 0.28;
const JAW_D = 0.13; /* wide enough to straddle the 0.09-thick disc */
const JAW_Y = R_ART + 0.1;
const RING_R = 0.068;
const RING_T = 0.016;
const RING_Y = R_ART + 0.31;
const TAB_W = 0.3; /* the folded tab is a little wider than the lace */
const TAB_H = 0.19;
const TAB_D = 0.09;
const TAB_Y = R_ART + 0.46;
const ROPE_END_Y = R_ART + 0.5; /* lace ends hidden inside the tab */

/* ---------- lanyard: flat woven webbing (never a rope) ---------- */
const ROPE_W = 0.25; /* width — reads as webbing, not cord */
const ROPE_T = 0.016; /* thickness: front and back are separate skins */
const ROPE_SEG = 48;
const STRAP_REPEAT = 5.6; /* printed pattern period, in world units */
const TWIST_MAX = 3; /* rad — a hard swing may flip the lace right over */

/* ---------- pendulum / rope-length dynamics ---------- */
const L_REST = 5; /* reference rope length the tuning below is based on */
const L_MIN = 1.85;
const THETA_MAX = 1.35; /* hard stop: the seal can never leave the frame */
const OMEGA_N = 1.844; /* natural frequency (rad/s) -> ~3.4 s period */
const DAMP = 1.4; /* free-swing damping (underdamped -> sway, then settle) */
const K_TH = 60; /* drag spring: swing */
const C_TH = 12;
const K_L = 24; /* free spring: rope length */
const C_L = 5.5;
const K_LD = 70; /* drag spring: rope length */
const C_LD = 15;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const smooth01 = (v: number) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------
   The lace.

   Two textures: the printed front face (the real ATecHS design) and a
   plain black back face, plus a shared relief map for the weave. Each
   canvas holds exactly ONE repeat of the pattern and is drawn as it
   appears on screen — x across the lace, y down it — with an aspect
   ratio of STRAP_REPEAT / ROPE_W so type is never distorted at any
   breakpoint (both axes scale with the same world units).
   ------------------------------------------------------------------ */
const LACE_W = 64;
const LACE_H = Math.round((LACE_W * STRAP_REPEAT) / ROPE_W);

const LACE_NAVY = "#1b2934"; /* woven polyester base — deep navy */
const LACE_PANEL = "#fbf7f0"; /* white printed panel */
const LACE_PANEL_INK = "#1a2740"; /* navy type on the panel */
const LACE_GOLD = "#c08a1e"; /* chevron + institutional gold */
const LACE_GOLD_LT = "#e0aa3c";
const LACE_WHITE = "#eef2f6"; /* values type */

function laceCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext("2d")!];
}

function laceTexture(cv: HTMLCanvasElement, aniso: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** grosgrain-style weave: ribs across the lace + warp threads along it */
function paintWeave(ctx: CanvasRenderingContext2D, w: number, h: number) {
  for (let y = 0; y < h; y += 6) {
    ctx.fillStyle = "rgba(4,7,12,0.17)";
    ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, y + 2, w, 1);
  }
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = "rgba(4,7,12,0.1)";
    ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(x + 1, 0, 1, h);
  }
}

/** darker selvedge + a soft centre sheen, so the lace reads as fabric */
function paintSelvedge(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(5,8,14,0.9)");
  g.addColorStop(0.07, "rgba(5,8,14,0.4)");
  g.addColorStop(0.42, "rgba(255,255,255,0.05)");
  g.addColorStop(0.58, "rgba(255,255,255,0.05)");
  g.addColorStop(0.93, "rgba(5,8,14,0.4)");
  g.addColorStop(1, "rgba(5,8,14,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** type printed along the lace: runs down the strap, auto-shrunk to fit */
function along(
  ctx: CanvasRenderingContext2D,
  w: number,
  text: string,
  y: number,
  maxLen: number,
  maxPx: number,
  color: string,
  weight: string
) {
  ctx.save();
  ctx.translate(w / 2, y);
  ctx.rotate(Math.PI / 2); /* +x now runs DOWN the lace */
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let s = maxPx;
  ctx.font = `${weight} ${s}px Arial, Helvetica, sans-serif`;
  while (s > 8 && ctx.measureText(text).width > maxLen) {
    s -= 1;
    ctx.font = `${weight} ${s}px Arial, Helvetica, sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** front face — the printed ATecHS design */
function makeLaceFrontTexture(aniso: number): THREE.CanvasTexture {
  const w = LACE_W;
  const h = LACE_H;
  const [cv, ctx] = laceCanvas(w, h);

  /* Screen mapping at rest (see the numbers below): canvas y is roughly
     -83 + 0.39 * y screen px, so y 0..570 is the faded top of the run and
     the window from the nav down to the end tab gets the whole design. */
  const panelTop = 570;
  const panelBot = 990;
  ctx.fillStyle = LACE_NAVY;
  ctx.fillRect(0, 0, w, panelTop);
  ctx.fillStyle = LACE_PANEL;
  ctx.fillRect(0, panelTop, w, panelBot - panelTop);
  ctx.fillStyle = LACE_NAVY;
  ctx.fillRect(0, panelBot, w, h - panelBot);

  /* gold chevron transitions between the blocks */
  const chevron = (y: number, depth: number, thick: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w / 2, y + depth);
    ctx.lineTo(w, y);
    ctx.lineTo(w, y + thick);
    ctx.lineTo(w / 2, y + depth + thick);
    ctx.lineTo(0, y + thick);
    ctx.closePath();
    ctx.fill();
  };
  chevron(546, 24, 14, LACE_GOLD);
  chevron(566, 24, 5, LACE_GOLD_LT);
  chevron(966, 24, 14, LACE_GOLD);
  chevron(986, 24, 5, LACE_GOLD_LT);

  /* printed school seal on the white panel */
  const sx = w / 2;
  const sy = 625;
  const sr = 26;
  ctx.fillStyle = LACE_NAVY;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LACE_GOLD;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(sx, sy, sr - 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = LACE_PANEL;
  ctx.beginPath();
  ctx.arc(sx, sy, sr - 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = LACE_GOLD;
  ctx.beginPath();
  ctx.arc(sx, sy, 6, 0, Math.PI * 2);
  ctx.fill();

  /* type running down the length of the lace */
  along(ctx, w, "ASSUMPTA TECHNICAL HIGH SCHOOL", 830, 260, 13, LACE_PANEL_INK, "700");
  along(ctx, w, "INSTITUTIONAL CORE VALUES", 420, 260, 15, LACE_GOLD_LT, "700");
  along(ctx, w, "FAITH", 1100, 160, 40, LACE_WHITE, "800");
  along(ctx, w, "TRUTH LOVE STEWARDSHIP", 1290, 240, 16, LACE_WHITE, "700");

  paintWeave(ctx, w, h);
  paintSelvedge(ctx, w, h);
  return laceTexture(cv, aniso);
}

/** back face — plain black woven fabric */
function makeLaceBackTexture(aniso: number): THREE.CanvasTexture {
  const [cv, ctx] = laceCanvas(LACE_W, LACE_H);
  ctx.fillStyle = "#0a0c10";
  ctx.fillRect(0, 0, LACE_W, LACE_H);
  paintWeave(ctx, LACE_W, LACE_H);
  paintSelvedge(ctx, LACE_W, LACE_H);
  return laceTexture(cv, aniso);
}

/** shared relief map: the same weave drives bump + roughness, so the
    ribs catch the light and the lace is never a flat colour plane */
function makeLaceBumpTexture(aniso: number): THREE.Texture {
  const [cv, ctx] = laceCanvas(LACE_W, LACE_H);
  ctx.fillStyle = "#8c8c8c";
  ctx.fillRect(0, 0, LACE_W, LACE_H);
  for (let y = 0; y < LACE_H; y += 6) {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillRect(0, y, LACE_W, 2);
    ctx.fillStyle = "#ededed";
    ctx.fillRect(0, y + 2, LACE_W, 1);
  }
  for (let x = 0; x < LACE_W; x += 4) {
    ctx.fillStyle = "#727272";
    ctx.fillRect(x, 0, 1, LACE_H);
    ctx.fillStyle = "#dcdcdc";
    ctx.fillRect(x + 1, 0, 1, LACE_H);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = aniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex; /* linear data — no colour space conversion */
}

/** navy woven fabric for the folded end tab */
function makeFabricTexture(aniso: number): THREE.CanvasTexture {
  const [cv, ctx] = laceCanvas(32, 32);
  ctx.fillStyle = LACE_NAVY;
  ctx.fillRect(0, 0, 32, 32);
  paintWeave(ctx, 32, 32);
  return laceTexture(cv, aniso);
}

/** small printed school seal on the end tab */
function makeTabSealTexture(): THREE.CanvasTexture {
  const [cv, ctx] = laceCanvas(64, 64);
  ctx.fillStyle = LACE_NAVY;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = LACE_GOLD;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(32, 32, 27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#efe9dc";
  ctx.beginPath();
  ctx.arc(32, 32, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LACE_NAVY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(32, 32, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = LACE_GOLD;
  ctx.beginPath();
  ctx.arc(32, 32, 6, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft depth cue behind the seal (kept very subtle on the dark hero). */
function makeShadowTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(0,0,0,0.7)");
  g.addColorStop(0.45, "rgba(0,0,0,0.32)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

export default function HeroBadge() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const twoCol = window.matchMedia(TWO_COL_QUERY);

    /* ---------- scene ---------- */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, BOX_BOTTOM + 3, CAM_Z);
    camera.lookAt(0, BOX_BOTTOM + 3, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL — leave the slot empty
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    mount.appendChild(canvas);
    const aniso = renderer.capabilities.getMaxAnisotropy();

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(2.5, 4, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x3b82f6, 20, 0, 2);
    rim.position.set(-2.6, -0.4, 3);
    scene.add(rim);

    const disposables: Array<{ dispose: () => void }> = [];

    /* ---------- soft shadow behind the seal ---------- */
    const shadowTex = makeShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(4.4, 4.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    disposables.push(shadowTex, shadowGeo, shadowMat);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.frustumCulled = false;
    shadow.renderOrder = -2;
    scene.add(shadow);

    /* ---------- the seal (the grabbable object) ---------- */
    const seal = new THREE.Group();
    scene.add(seal);

    const backGeo = new THREE.CylinderGeometry(BACK_R, BACK_R, THICK, 96);
    backGeo.rotateX(Math.PI / 2); // flat faces toward the camera
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x0e1116,
      roughness: 0.45,
      metalness: 0.4,
    });
    disposables.push(backGeo, backMat);
    seal.add(new THREE.Mesh(backGeo, backMat));

    // printed seal face — hidden until the canonical file lands
    const faceGeo = new THREE.CircleGeometry(R_GEO, 96);
    const faceMat = new THREE.MeshStandardMaterial({
      roughness: 0.45,
      metalness: 0.05,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      transparent: true, // official seal ships with transparency — honor its alpha
    });
    disposables.push(faceGeo, faceMat);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = THICK / 2 + 0.005;
    face.visible = false; // no drawn substitute — the real asset only
    seal.add(face);

    // connector gripping the top edge of the seal: swivel clasp -> D-ring
    // -> folded navy end tab with a printed seal (the lace ends inside it)
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xc9ced6,
      roughness: 0.3,
      metalness: 0.75,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.55,
      metalness: 0.3,
    });
    const jawGeo = new RoundedBoxGeometry(JAW_W, JAW_H, JAW_D, 4, 0.05);
    const seamGeo = new THREE.BoxGeometry(JAW_W + 0.014, 0.03, JAW_D + 0.014);
    const jaw = new THREE.Mesh(jawGeo, metalMat);
    jaw.position.y = JAW_Y;
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.position.y = JAW_Y + 0.03;

    const ringGeo = new THREE.TorusGeometry(RING_R, RING_T, 10, 28);
    const ring = new THREE.Mesh(ringGeo, metalMat);
    ring.position.y = RING_Y;

    const tabTex = makeFabricTexture(aniso);
    const tabMat = new THREE.MeshStandardMaterial({
      map: tabTex,
      bumpMap: tabTex,
      bumpScale: 0.004,
      roughness: 0.88,
      metalness: 0,
    });
    const tabGeo = new RoundedBoxGeometry(TAB_W, TAB_H, TAB_D, 3, 0.03);
    const tab = new THREE.Mesh(tabGeo, tabMat);
    tab.position.y = TAB_Y;

    const stitchMat = new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.95 });
    const stitchGeo = new THREE.BoxGeometry(TAB_W * 0.84, 0.014, TAB_D + 0.008);
    const stitchTop = new THREE.Mesh(stitchGeo, stitchMat);
    stitchTop.position.y = TAB_Y + TAB_H * 0.32;
    const stitchBot = new THREE.Mesh(stitchGeo, stitchMat);
    stitchBot.position.y = TAB_Y - TAB_H * 0.32;

    const tabSealTex = makeTabSealTexture();
    const tabSealMat = new THREE.MeshStandardMaterial({ map: tabSealTex, roughness: 0.7, metalness: 0 });
    const tabSealGeo = new THREE.CircleGeometry(TAB_W * 0.26, 24);
    const tabSeal = new THREE.Mesh(tabSealGeo, tabSealMat);
    tabSeal.position.set(0, TAB_Y, TAB_D / 2 + 0.004);

    seal.add(jaw, seam, ring, tab, stitchTop, stitchBot, tabSeal);
    disposables.push(
      metalMat, seamMat, jawGeo, seamGeo, ringGeo,
      tabTex, tabMat, tabGeo, stitchMat, stitchGeo,
      tabSealTex, tabSealMat, tabSealGeo
    );

    /* ---------- swap in the real logo ---------- */
    let unmounted = false;
    let loadedLogo: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      LOGO_SRC,
      (tex) => {
        if (unmounted) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = aniso;
        faceMat.map = tex;
        faceMat.emissiveMap = tex;
        faceMat.needsUpdate = true;
        face.visible = true;
        loadedLogo = tex;
        /* reduced motion draws static frames (no continuous rAF), so
           repaint now or the seal would stay blank forever. */
        if (reduced) renderer.render(scene, camera);
      },
      undefined,
      () => {
        /* asset missing — the dark backing stays, nothing is faked */
      }
    );

    /* ---------- the lace: front print + black back, rebuilt each frame ----------
       Four vertices per row — printed face, black face — plus the two
       selvedges, in one buffer with two material groups. */
    const laceFrontTex = makeLaceFrontTexture(aniso);
    const laceBackTex = makeLaceBackTexture(aniso);
    const laceBumpTex = makeLaceBumpTexture(aniso);
    const rows = ROPE_SEG + 1;
    const V_PER_ROW = 4; // A front, B front, A back, B back
    const laceGeo = new THREE.BufferGeometry();
    const lacePos = new Float32Array(rows * V_PER_ROW * 3);
    const laceUv = new Float32Array(rows * V_PER_ROW * 2);
    const laceCol = new Float32Array(rows * V_PER_ROW * 4).fill(1); // RGBA vertex alpha
    const frontIdx: number[] = [];
    const backIdx: number[] = []; // back face + both selvedges
    for (let i = 0; i < ROPE_SEG; i++) {
      const a = i * V_PER_ROW;
      frontIdx.push(a, a + 1, a + 4, a + 1, a + 5, a + 4);
      backIdx.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
      backIdx.push(a, a + 4, a + 2, a + 2, a + 4, a + 6); // left selvedge
      backIdx.push(a + 1, a + 3, a + 5, a + 3, a + 7, a + 5); // right selvedge
    }
    const laceIdx = frontIdx.concat(backIdx);
    laceGeo.setAttribute("position", new THREE.BufferAttribute(lacePos, 3));
    laceGeo.setAttribute("uv", new THREE.BufferAttribute(laceUv, 2));
    laceGeo.setAttribute("color", new THREE.BufferAttribute(laceCol, 4));
    laceGeo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(lacePos.length), 3));
    laceGeo.setIndex(laceIdx);
    laceGeo.addGroup(0, frontIdx.length, 0);
    laceGeo.addGroup(frontIdx.length, backIdx.length, 1);

    const laceCommon = {
      roughness: 1,
      metalness: 0,
      bumpMap: laceBumpTex,
      bumpScale: 0.006,
      roughnessMap: laceBumpTex,
      side: THREE.DoubleSide,
      vertexColors: true,
      transparent: true, // top of the lace fades out — no visible endpoint
    };
    const laceFrontMat = new THREE.MeshStandardMaterial({
      ...laceCommon,
      map: laceFrontTex,
      emissive: 0xffffff,
      emissiveMap: laceFrontTex,
      emissiveIntensity: 0.15, // lift the print without flattening the navy
    });
    const laceBackMat = new THREE.MeshStandardMaterial({ ...laceCommon, map: laceBackTex });
    disposables.push(laceFrontTex, laceBackTex, laceBumpTex, laceGeo, laceFrontMat, laceBackMat);
    const lace = new THREE.Mesh(laceGeo, [laceFrontMat, laceBackMat]);
    lace.frustumCulled = false; // positions are rewritten every frame
    lace.renderOrder = -1;
    scene.add(lace);

    /* ---------- sizing / framing / drag bounds ---------- */
    const bounds = { x: 1, yMin: BOT_Y, yMax: TOP_Y };
    let pxPerUnit = 100;
    let fadeY0 = 0; // world y where the strap becomes fully transparent
    let fadeY1 = 0; // world y where the strap is fully opaque again

    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);

      /* On the 2-column hero the badge sits in the right column, so the
         canvas can grow up to the top of the page without ever covering
         the copy; the hero's overflow:hidden clips it at the frame. */
      const rect = mount.getBoundingClientRect();
      const pageTop = rect.top + window.scrollY;
      const ext = twoCol.matches ? clamp(Math.round(pageTop + 24), 0, 760) : 0;
      const hc = h + ext;

      pxPerUnit = h / BOX_UNITS; // pixels per world unit (box height decides)
      const halfH = (hc / pxPerUnit) / 2;
      const camY = BOX_BOTTOM + halfH; // box bottom stays put on screen

      renderer.setSize(w, hc, false);
      canvas.style.top = `${-ext}px`;
      canvas.style.height = `${hc}px`;

      camera.aspect = w / hc;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfH / CAM_Z));
      camera.position.set(0, camY, CAM_Z);
      camera.lookAt(0, camY, 0);
      camera.updateProjectionMatrix();

      /* the anchor rides just above the top edge of the (taller) canvas */
      ANCHOR.set(0, camY + halfH + 0.6, 0);
      L0 = Math.max(L_REST, ANCHOR.y - REST_Y);
      L_MAX = L0 + 3; // the seal may drop to the bottom of the box, no further
      G = OMEGA_N * OMEGA_N * L0; // constant period whatever the rope length

      bounds.x = Math.max(0.25, halfH * camera.aspect - R_GEO - 0.08);
      bounds.yMax = TOP_Y - R_GEO - 0.1;
      bounds.yMin = BOT_Y + R_GEO + 0.08;

      /* fade the strap's head out: invisible behind the nav band (or,
         on the stacked hero, straight from the top of its own box) */
      const nav = document.querySelector<HTMLElement>(".nav");
      const navBottom = nav ? nav.getBoundingClientRect().bottom + window.scrollY : 0;
      const canvasTopPage = pageTop - ext;
      const fadeStartPx = clamp(navBottom - canvasTopPage, 0, ext);
      const fadeLenPx = ext > 0 ? 150 : 70;
      fadeY0 = camY + halfH - fadeStartPx / pxPerUnit;
      fadeY1 = camY + halfH - (fadeStartPx + fadeLenPx) / pxPerUnit;

      if (reduced) renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(() => resize());
    ro.observe(mount);
    twoCol.addEventListener("change", resize);

    /* ---------- state ---------- */
    let L0 = L_REST; // rope length at rest (resize() puts the real value in)
    let L_MAX = L_REST + 3; // longest rope the swing may take
    let G = OMEGA_N * OMEGA_N * L0;
    let theta = 0; // swing angle from vertical (rad)
    let omega = 0; // angular velocity
    let L = L0; // rope length
    let vL = 0; // rope length velocity
    let dragging = false;
    let raf = 0;
    let running = false;
    let last = performance.now();

    resize(); // first framing pass — fills in L0 / G / bounds / fade
    L = L0;

    const tx = new THREE.Vector3(); // scratch: pointer -> world (plane z = 0)
    const endLocal = new THREE.Vector3(0, ROPE_END_Y, 0);
    const endWorld = new THREE.Vector3();
    const projA = new THREE.Vector3();
    const projB = new THREE.Vector3();

    const target = new THREE.Vector2(ANCHOR.x, ANCHOR.y - L0);
    const sealPos = new THREE.Vector2(ANCHOR.x, ANCHOR.y - L0);

    /* overdamped constants — used for prefers-reduced-motion so nothing
       oscillates: grabbing still works, swinging does not */
    const cFree = reduced ? 2.2 * Math.sqrt(OMEGA_N * OMEGA_N) : DAMP;
    const cTh = reduced ? 2.2 * Math.sqrt(K_TH) : C_TH;
    const cL = reduced ? 2.2 * Math.sqrt(K_L) : C_L;
    const cLd = reduced ? 2.2 * Math.sqrt(K_LD) : C_LD;

    const pointerToWorld = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      tx.set(ndcX, ndcY, 0.5).unproject(camera);
      const d = tx.sub(camera.position).normalize();
      const k = -camera.position.z / d.z; // intersect plane z = 0
      return { x: camera.position.x + d.x * k, y: camera.position.y + d.y * k };
    };

    const setTarget = (e: PointerEvent) => {
      const p = pointerToWorld(e);
      target.set(clamp(p.x, -bounds.x, bounds.x), clamp(p.y, bounds.yMin, bounds.yMax));
    };

    /** is this pointer over the seal? (grab affordance + drag start) */
    const overSeal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      projA.set(sealPos.x, sealPos.y, 0).project(camera);
      projB.set(sealPos.x + R_ART, sealPos.y, 0).project(camera);
      const cx = rect.left + (projA.x * 0.5 + 0.5) * rect.width;
      const cy = rect.top + (-projA.y * 0.5 + 0.5) * rect.height;
      const r = Math.hypot(
        (projB.x - projA.x) * 0.5 * rect.width,
        (-projB.y + projA.y) * 0.5 * rect.height
      );
      return Math.hypot(e.clientX - cx, e.clientY - cy) <= r + 4;
    };

    /* ---------- scratch for the two-pass lace fit ---------- */
    const rowCx = new Float32Array(rows);
    const rowCy = new Float32Array(rows);
    const rowTx = new Float32Array(rows);
    const rowTy = new Float32Array(rows);
    const rowArc = new Float32Array(rows);

    /* ---------- lanyard fit: anchor -> tab, curvature, twist, alpha ---------- */
    const updateRope = () => {
      endWorld.copy(endLocal).applyMatrix4(seal.matrixWorld);
      const dx = endWorld.x - ANCHOR.x;
      const dy = endWorld.y - ANCHOR.y;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const dirx = dx / len;
      const diry = dy / len;
      const perx = -diry;
      const pery = dirx;
      /* bow: the lace trails the motion and leans into the pull */
      const bow = clamp(-omega * 0.3, -0.7, 0.7) + 0.05 * len * Math.sin(theta);

      const p0x = ANCHOR.x;
      const p0y = ANCHOR.y;
      const p3x = endWorld.x;
      const p3y = endWorld.y;
      /* leaves the top edge pointing straight down and arrives at the
         tab pointing straight down — the diagonal sits in between */
      const p1x = p0x + perx * bow * 0.5;
      const p1y = p0y - len * 0.42 + pery * bow * 0.5;
      const p2x = p3x - perx * bow;
      const p2y = p3y + len * 0.34 - pery * bow;

      /* pass 1 — centreline, tangent and arc length (the print is mapped
         by real arc length, so it never stretches when the lace extends) */
      let px = p0x;
      let py = p0y;
      for (let i = 0; i <= ROPE_SEG; i++) {
        const t = i / ROPE_SEG;
        const u = 1 - t;
        const b0 = u * u * u;
        const b1 = 3 * u * u * t;
        const b2 = 3 * u * t * t;
        const b3 = t * t * t;
        const x = b0 * p0x + b1 * p1x + b2 * p2x + b3 * p3x;
        const y = b0 * p0y + b1 * p1y + b2 * p2y + b3 * p3y;

        const gx = 3 * u * u * (p1x - p0x) + 6 * u * t * (p2x - p1x) + 3 * t * t * (p3x - p2x);
        const gy = 3 * u * u * (p1y - p0y) + 6 * u * t * (p2y - p1y) + 3 * t * t * (p3y - p2y);
        const gl = Math.hypot(gx, gy) || 1;

        rowCx[i] = x;
        rowCy[i] = y;
        rowTx[i] = gx / gl;
        rowTy[i] = gy / gl;
        rowArc[i] = i === 0 ? 0 : rowArc[i - 1] + Math.hypot(x - px, y - py);
        px = x;
        py = y;
      }
      const total = rowArc[ROPE_SEG] || 1e-3;

      /* Twist about the lace's own axis: the pull rolls the free span over
         (the black back shows), the roll dies out where the tab stitches it
         flat, and the connector's yaw runs right down to it. */
      const freeTwist = clamp(theta * 4 + omega * 1.5, -TWIST_MAX, TWIST_MAX);
      const yawTwist = -seal.rotation.y;
      const hw = ROPE_W * 0.5;
      const ht = ROPE_T * 0.5;
      const fadeDen = fadeY0 - fadeY1;

      /* pass 2 — four-sided cross section */
      for (let i = 0; i <= ROPE_SEG; i++) {
        const t = i / ROPE_SEG;
        const sFree = Math.pow(t, 1.3) * (1 - smooth01((t - 0.93) / 0.07));
        const phi = yawTwist * Math.pow(t, 0.6) + freeTwist * sFree;
        const cs = Math.cos(phi);
        const sn = Math.sin(phi);

        /* U' runs across the lace, N' out through its printed face */
        const ux = -rowTy[i];
        const uy = rowTx[i];
        const uX = ux * cs;
        const uY = uy * cs;
        const uZ = sn;
        const nX = -ux * sn;
        const nY = -uy * sn;
        const nZ = cs;

        const cx = rowCx[i];
        const cy = rowCy[i];
        const vi = i * V_PER_ROW;
        const bi = vi * 3;
        // printed face
        lacePos[bi] = cx + uX * hw + nX * ht;
        lacePos[bi + 1] = cy + uY * hw + nY * ht;
        lacePos[bi + 2] = uZ * hw + nZ * ht;
        lacePos[bi + 3] = cx - uX * hw + nX * ht;
        lacePos[bi + 4] = cy - uY * hw + nY * ht;
        lacePos[bi + 5] = -uZ * hw + nZ * ht;
        // black back, one thickness behind it
        lacePos[bi + 6] = cx + uX * hw - nX * ht;
        lacePos[bi + 7] = cy + uY * hw - nY * ht;
        lacePos[bi + 8] = uZ * hw - nZ * ht;
        lacePos[bi + 9] = cx - uX * hw - nX * ht;
        lacePos[bi + 10] = cy - uY * hw - nY * ht;
        lacePos[bi + 11] = -uZ * hw - nZ * ht;

        // u = 0 at the left edge as seen on screen, v by arc length
        const v = (total - rowArc[i]) / STRAP_REPEAT;
        const ui = vi * 2;
        laceUv[ui] = 1;
        laceUv[ui + 1] = v;
        laceUv[ui + 2] = 0;
        laceUv[ui + 3] = v;
        laceUv[ui + 4] = 1;
        laceUv[ui + 5] = v;
        laceUv[ui + 6] = 0;
        laceUv[ui + 7] = v;

        const a = fadeDen > 1e-6 ? clamp((fadeY0 - cy) / fadeDen, 0, 1) : 1;
        const ci = vi * 4;
        for (let k = 0; k < 4; k++) {
          laceCol[ci + k * 4] = 1;
          laceCol[ci + k * 4 + 1] = 1;
          laceCol[ci + k * 4 + 2] = 1;
          laceCol[ci + k * 4 + 3] = a;
        }
      }
      laceGeo.attributes.position.needsUpdate = true;
      laceGeo.attributes.uv.needsUpdate = true;
      laceGeo.attributes.color.needsUpdate = true;
      laceGeo.computeVertexNormals();
    };

    /* ---------- pose ---------- */
    const applyPose = () => {
      sealPos.set(ANCHOR.x + L * Math.sin(theta), ANCHOR.y - L * Math.cos(theta));
      /* the seal hangs along the rope, with a little rotational lag */
      const lag = clamp(omega * 0.1, -0.18, 0.18);
      const wob = clamp(-omega * 0.035, -0.12, 0.12);
      seal.position.set(sealPos.x, sealPos.y, 0);
      seal.rotation.set(wob, -0.11 + clamp(sealPos.x * 0.05, -0.12, 0.12), theta - lag);
      seal.updateMatrixWorld();
      shadow.position.set(sealPos.x + 0.18, sealPos.y - 0.22, -0.55);
      updateRope();
    };

    /* ---------- physics ---------- */
    const atRest = () =>
      Math.abs(theta) < 1e-3 &&
      Math.abs(omega) < 5e-3 &&
      Math.abs(L - L0) < 2e-3 &&
      Math.abs(vL) < 8e-3;

    const step = (dt: number) => {
      if (dragging) {
        const dx = target.x - ANCHOR.x;
        const dy = target.y - ANCHOR.y;
        const thT = clamp(Math.atan2(dx, -dy), -THETA_MAX, THETA_MAX);
        const lT = clamp(Math.hypot(dx, dy), L_MIN, L_MAX);
        omega += (K_TH * (thT - theta) - cTh * omega) * dt;
        vL += (K_LD * (lT - L) - cLd * vL) * dt;
      } else {
        omega += (-(G / L) * Math.sin(theta) - cFree * omega) * dt;
        vL += (-K_L * (L - L0) - cL * vL) * dt;
      }

      theta += omega * dt;
      L += vL * dt;

      if (theta > THETA_MAX) {
        theta = THETA_MAX;
        if (omega > 0) omega = 0;
      } else if (theta < -THETA_MAX) {
        theta = -THETA_MAX;
        if (omega < 0) omega = 0;
      }
      if (L > L_MAX) {
        L = L_MAX;
        if (vL > 0) vL = 0;
      } else if (L < L_MIN) {
        L = L_MIN;
        if (vL < 0) vL = 0;
      }

      if (!dragging && atRest()) {
        theta = 0;
        omega = 0;
        L = L0;
        vL = 0;
      }
      applyPose();
    };

    /* ---------- loop ---------- */
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(dt);
      renderer.render(scene, camera);
      if (reduced && !dragging && atRest()) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const ensureLoop = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    /* ---------- pointer (bound to the layout box, never to the grown
       canvas, so the part of the canvas above the box can never swallow
       clicks meant for the nav or the hero copy) ---------- */
    const onDown = (e: PointerEvent) => {
      if (!overSeal(e)) return; // only the seal is grabbable
      if (e.cancelable) e.preventDefault(); // no text selection while dragging
      dragging = true;
      mount.setPointerCapture(e.pointerId);
      mount.style.cursor = "grabbing";
      setTarget(e);
      ensureLoop();
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) {
        setTarget(e);
        ensureLoop();
      } else {
        mount.style.cursor = overSeal(e) ? "grab" : "";
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (mount.hasPointerCapture(e.pointerId)) {
        mount.releasePointerCapture(e.pointerId);
      }
      mount.style.cursor = overSeal(e) ? "grab" : "";
      ensureLoop(); // reduced motion: ease back to rest without oscillating
    };
    const onLeave = () => {
      if (!dragging) mount.style.cursor = "";
    };

    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("pointerup", onUp);
    mount.addEventListener("pointercancel", onUp);
    mount.addEventListener("pointerleave", onLeave);

    applyPose();
    if (reduced) {
      renderer.render(scene, camera);
    } else {
      ensureLoop();
    }

    /* ---------- cleanup ---------- */
    return () => {
      unmounted = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      twoCol.removeEventListener("change", resize);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerup", onUp);
      mount.removeEventListener("pointercancel", onUp);
      mount.removeEventListener("pointerleave", onLeave);
      if (loadedLogo) loadedLogo.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (canvas.parentElement === mount) {
        mount.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="hero-badge"
      role="img"
      aria-label="The ATecHS Society logo hanging from a lanyard — grab it, drag it, and let go to watch it swing"
    />
  );
}
