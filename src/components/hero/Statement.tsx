"use client";

import { useEffect, useRef } from "react";
import Marquee from "@/components/ui/Marquee";

const LINES = [
  <>
    <span className="light">One hub for everything ATecHS Society creates, organizes,</span>
  </>,
  <>
    <span className="light">and accomplishes —</span>{" "}
    <span className="bold">live events, upcoming plans,</span>
  </>,
  <>
    <span className="bold">and a growing public archive</span>{" "}
    <span className="light">of our work.</span>
  </>,
  <>
    <span className="light">Built by members,</span> <span className="bold">open to everyone.</span>
  </>,
];

/* Reference behavior: continuous scroll-linked drift (framer useScroll +
   useTransform + useSpring). Each line maps a window of the section's
   scroll progress to opacity 0→1 and translateY 80px→0 — no discrete
   toggles. Progress is smoothed with a lerp (the reference's useSpring). */
const START = 0.06;
const STEP = 0.21;
const WINDOW = 0.24;
const RISE = 80; // px, matches reference initial transform: translateY(80px)
const SMOOTH = 0.14;

export default function Statement() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const lines = Array.from(wrap.querySelectorAll<HTMLElement>(".statement-line"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      lines.forEach((l) => {
        l.style.opacity = "1";
        l.style.transform = "none";
      });
      return;
    }

    let raf = 0;
    let smooth = -1; // -1 = uninitialized (first frame snaps to target)

    const target = () => {
      const rect = wrap.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const p = span > 0 ? -rect.top / span : 1;
      return Math.min(1, Math.max(0, p));
    };

    const paint = (p: number) => {
      lines.forEach((line, i) => {
        const local = Math.min(1, Math.max(0, (p - (START + i * STEP)) / WINDOW));
        line.style.opacity = String(local);
        line.style.transform = `translateY(${(RISE * (1 - local)).toFixed(2)}px)`;
      });
    };

    const tick = () => {
      const t = target();
      smooth = smooth < 0 ? t : smooth + (t - smooth) * SMOOTH;
      const settled = Math.abs(t - smooth) <= 0.0005;
      if (settled) smooth = t;
      paint(smooth);
      raf = settled ? 0 : window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };

    schedule(); // initial paint (lines below viewport stay at opacity 0)
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="statement-wrap" ref={wrapRef}>
      <div className="statement-curve" aria-hidden="true" />
      <div className="statement-sticky">
        <div className="statement-glow" aria-hidden="true">
          <span />
        </div>
        <div className="statement-lines">
          {LINES.map((content, i) => (
            <p
              className="statement-line"
              key={i}
              /* SSR initial state = reference inline style opacity:0; translateY(80px) */
              style={{ opacity: 0, transform: `translateY(${RISE}px)` }}
            >
              {content}
            </p>
          ))}
        </div>
        <Marquee />
      </div>
    </div>
  );
}
