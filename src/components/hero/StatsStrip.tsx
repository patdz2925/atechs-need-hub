"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Image as ImageIcon, Layers, Users } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { stats } from "@/data/events";

const ICONS = [Award, ImageIcon, Layers, Users];

function Counter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || started.current) return;
          started.current = true;
          const dur = 1200;
          let start: number | null = null;
          const step = (ts: number) => {
            if (start === null) start = ts;
            const p = Math.min(1, (ts - start) / dur);
            setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) window.requestAnimationFrame(step);
          };
          window.requestAnimationFrame(step);
          io.disconnect();
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return <span ref={ref}>{display}</span>;
}

export default function StatsStrip() {
  return (
    <div className="stats-strip">
      <div className="container stats-grid">
        {stats.map((st, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <Reveal key={st.label} direction="up" delay={i * 120} className="stat-card">
              <div
                className="stat-icon pre"
                data-pop
                style={{ transitionDelay: `${i * 120 + 150}ms` }}
              >
                <Icon size={24} />
              </div>
              <div>
                <h3>
                  <Counter value={st.value} />
                  {st.suffix}
                </h3>
                <p>
                  {st.label} · {st.sub}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
