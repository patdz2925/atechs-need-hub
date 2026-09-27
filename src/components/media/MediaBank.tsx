"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Image as ImageIcon, LayoutDashboard, Video } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/ui/SectionHead";
import { MediaThumb } from "./MediaBits";
import {
  MEDIA_TYPE_LABEL,
  type MediaItem,
  type MediaType,
} from "@/lib/media/types";
import type { CSSProperties } from "react";

const ICONS = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  other: LayoutDashboard,
} as const;

const FILTERS = ["all", "image", "video", "document", "other"] as const;

interface MediaBankProps {
  /** Live RLS-scoped counts (anonymous visitors see zeros). */
  counts: Record<MediaType, number>;
  /** Live RLS-scoped featured rows (empty when invisible). */
  featured: MediaItem[];
}

export default function MediaBank({ counts, featured }: MediaBankProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const cats: MediaType[] = ["image", "video", "document", "other"];
  const max = Math.max(1, ...cats.map((c) => counts[c]));
  const total = cats.reduce((n, c) => n + counts[c], 0);

  return (
    <section className="section" id="media" aria-labelledby="media-title">
      <div className="giant-word" aria-hidden="true">
        <span>MEDIA</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Photos · Videos · Graphics · Documents"
          title="Media Bank"
          titleId="media-title"
          sub="Every photo, video, graphic, and document — organized in one place."
        />
        <Reveal direction="fade" className="filter-tabs">
          <div role="group" aria-label="Filter media by category" style={{ display: "contents" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                data-filter={f}
                aria-selected={filter === f}
                className={filter === f ? "is-active" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "image" ? "Photos" : `${MEDIA_TYPE_LABEL[f]}s`}
              </button>
            ))}
          </div>
        </Reveal>
        <div className="cards-4">
          {cats.map((cat, i) => {
            const Icon = ICONS[cat];
            const dimmed = filter !== "all" && filter !== cat;
            return (
              <Reveal
                key={cat}
                direction="up"
                delay={i * 150}
                tilt
                className={`card media-card${dimmed ? " is-dimmed" : ""}`}
              >
                <div className={`media-thumb thumb-${cat === "image" ? "photos" : cat === "video" ? "videos" : cat === "document" ? "documents" : "graphics"}`} aria-hidden="true">
                  <Icon size={40} />
                </div>
                <h3>{cat === "image" ? "Photos" : `${MEDIA_TYPE_LABEL[cat]}s`}</h3>
                <p className="media-count">{counts[cat]} items</p>
                <div className="media-bar">
                  <i style={{ "--p": `${Math.round((counts[cat] / max) * 100)}%` } as CSSProperties} />
                </div>
                <Link className="media-link" href={`/media?type=${cat}`}>
                  Browse →
                </Link>
              </Reveal>
            );
          })}
        </div>

        {featured.length > 0 && (
          <div className="mb-featured">
            <p className="mb-featured-kicker">Featured</p>
            <div className="mb-featured-row">
              {featured.map((m) => (
                <Link key={m.id} href={`/media/${m.id}`} className="mb-featured-card">
                  <MediaThumb item={m} />
                  <span className="mb-featured-title">{m.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="drive-note">The archive is filling up — check back soon.</p>
        )}
        <Reveal direction="fade" className="drive-note">
          Live index · <code>Google Drive</code> stores, the Hub organizes —{" "}
          <Link href="/media">open the Media Bank</Link>.
        </Reveal>
      </div>
    </section>
  );
}
