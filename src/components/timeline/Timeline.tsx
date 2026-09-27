"use client";

import { useEffect, useRef } from "react";
import {
  Calendar,
  Flag,
  Landmark,
  Mic,
  PartyPopper,
  Rocket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useInView } from "@/hooks/useInView";
import SectionHead from "@/components/ui/SectionHead";
import { timeline, type TimelineEntry } from "@/data/events";

/* Reference: every node holds a lucide icon — one fitting icon per card. */
const NODE_ICONS: Record<string, LucideIcon> = {
  "Employees' Week": PartyPopper,
  "Tech Talk": Mic,
  "Foundation Activity": Landmark,
  "Digital Platform Launch": Rocket,
  "Tech Talk Series": Users,
  "Employees' Week 2025": Flag,
};

function TimelineItem({ item, index }: { item: TimelineEntry; index: number }) {
  const { ref, inView } = useInView<HTMLLIElement>();
  const Icon = NODE_ICONS[item.title] ?? Calendar;
  const isCurrent = item.status === "current";

  return (
    <li
      ref={ref}
      data-reveal="up"
      className={`timeline-item${inView ? " is-visible" : ""}`}
      style={index % 3 !== 0 ? { transitionDelay: `${(index % 3) * 120}ms` } : undefined}
    >
      <span className="timeline-node" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className="timeline-card-wrap">
        <article className="timeline-card">
          <span className="timeline-eyebrow">
            <Calendar size={12} strokeWidth={2} aria-hidden="true" />
            {item.year}
          </span>
          <h3>{item.title}</h3>
          <p className={`timeline-sub${isCurrent ? " is-current" : ""}`}>
            {isCurrent ? "Current" : "Completed"}
          </p>
          <p className="timeline-desc">{item.description}</p>
        </article>
      </div>
      <div className="timeline-spacer" aria-hidden="true" />
    </li>
  );
}

export default function Timeline() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);

  /* Scroll-driven gradient line: grows as the section passes through the viewport
     (reference: origin-top scaleY from #3b82f6 → #93c5fd → #3b82f6 with blue glow). */
  useEffect(() => {
    const wrap = wrapRef.current;
    const fill = fillRef.current;
    if (!wrap || !fill) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fill.style.transform = "scaleY(1)";
      return;
    }

    let ticking = false;
    let raf = 0;
    const update = () => {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh - rect.top) / Math.max(1, rect.height)));
      fill.style.transform = `scaleY(${p.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = window.requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="section" id="timeline" aria-labelledby="timeline-title">
      <div className="giant-word" aria-hidden="true">
        <span>HISTORY</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Our Journey"
          title="Organizational Timeline"
          titleId="timeline-title"
          sub="Key moments that shaped ATecHS Society into what it is today."
        />
        <div className="timeline" ref={wrapRef}>
          <div className="timeline-line" aria-hidden="true">
            <span className="timeline-line-fill" ref={fillRef} />
          </div>
          <ol className="timeline-list">
            {timeline.map((item, i) => (
              <TimelineItem key={`${item.year}-${item.title}`} item={item} index={i} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
