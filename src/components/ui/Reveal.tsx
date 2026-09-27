"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInView } from "@/hooks/useInView";
import { useTilt } from "@/hooks/useTilt";

export type RevealDirection = "up" | "down" | "left" | "right" | "fade";

interface RevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  /** stagger delay in ms */
  delay?: number;
  /** travel distance (px) for up/down — reference uses 20 / 24 / 50 */
  distance?: number;
  className?: string;
  id?: string;
  /** enable cursor-tracking 3D tilt on this element */
  tilt?: boolean;
}

/** Scroll-triggered entrance. Pairs with [data-reveal] styles. */
export default function Reveal({
  children,
  direction = "up",
  delay = 0,
  distance,
  className = "",
  id,
  tilt = false,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  useTilt(ref, tilt);
  const style: CSSProperties & Record<string, string | number> = {};
  if (delay) style.transitionDelay = `${delay}ms`;
  if (distance !== undefined) style["--rev-y"] = `${distance}px`;
  return (
    <div
      id={id}
      ref={ref}
      data-reveal={direction}
      data-tilt={tilt ? "true" : undefined}
      className={`${className}${inView ? " is-visible" : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
