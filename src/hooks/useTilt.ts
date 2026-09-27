"use client";

import { useEffect, type RefObject } from "react";

/** Max rotation in degrees — subtle "lean" strength. */
const MAX_DEG = 10;
/** Lift in px while hovering. */
const LIFT = 8;
/** Per-frame easing (buttery tracking + soft spring-back). */
const EASE = 0.16;
/** Distance (deg + px) below which we consider the card settled. */
const SETTLE = 0.02;

/**
 * Cursor-tracking 3D tilt.
 *
 * Attaches pointer handlers to the referenced element and writes CSS vars:
 *   --tilt-rx / --tilt-ry  rotation (edge nearest the cursor leans away)
 *   --tilt-lift            translateZ-style lift
 *   --tilt-gx / --tilt-gy  cursor position for the sheen gradient
 * Also toggles the `is-tilting` class while active.
 *
 * Only runs with a real pointer (hover: hover) and honors
 * prefers-reduced-motion. Safe to enable on server-rendered elements.
 */
export function useTilt<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled = false
) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let hovering = false;
    let curX = 0;
    let curY = 0;
    let curL = 0;
    let tgtX = 0;
    let tgtY = 0;
    let tgtL = 0;

    const write = () => {
      el.style.setProperty("--tilt-rx", `${curX.toFixed(3)}deg`);
      el.style.setProperty("--tilt-ry", `${curY.toFixed(3)}deg`);
      el.style.setProperty("--tilt-lift", `${curL.toFixed(2)}px`);
    };

    const loop = () => {
      curX += (tgtX - curX) * EASE;
      curY += (tgtY - curY) * EASE;
      curL += (tgtL - curL) * EASE;
      write();

      const settled =
        Math.abs(tgtX - curX) + Math.abs(tgtY - curY) + Math.abs(tgtL - curL) <
        SETTLE;
      if (settled) {
        curX = tgtX;
        curY = tgtY;
        curL = tgtL;
        write();
        raf = 0;
        if (!hovering) el.classList.remove("is-tilting");
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      // Lean AWAY from the cursor:
      //  cursor right  -> rotateY positive -> right edge recedes
      //  cursor top    -> rotateX positive -> top edge recedes
      tgtY = (px - 0.5) * 2 * MAX_DEG;
      tgtX = (0.5 - py) * 2 * MAX_DEG;
      tgtL = LIFT;
      el.style.setProperty("--tilt-gx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--tilt-gy", `${(py * 100).toFixed(1)}%`);
      kick();
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovering = true;
      el.classList.add("is-tilting");
      onMove(e);
    };

    const onLeave = () => {
      hovering = false;
      tgtX = 0;
      tgtY = 0;
      tgtL = 0;
      kick();
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      el.classList.remove("is-tilting");
      el.style.removeProperty("--tilt-rx");
      el.style.removeProperty("--tilt-ry");
      el.style.removeProperty("--tilt-lift");
      el.style.removeProperty("--tilt-gx");
      el.style.removeProperty("--tilt-gy");
    };
  }, [ref, enabled]);
}
