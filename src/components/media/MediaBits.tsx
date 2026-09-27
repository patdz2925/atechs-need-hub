"use client";

/* ============================================================
   Media Bank — shared presentational bits: type icon, visibility
   pill, thumbnail-with-fallback and the grid card. Pure markup +
   links (state only for image fallback), usable anywhere.
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { FileText, Film, Image as ImageIcon, Layers } from "lucide-react";
import {
  MEDIA_TYPE_LABEL,
  MEDIA_VISIBILITY_LABEL,
  driveThumbnailUrl,
  type MediaItem,
  type MediaType,
  type MediaVisibility,
} from "@/lib/media/types";

export function MediaTypeIcon({ type, size = 40 }: { type: MediaType; size?: number }) {
  if (type === "video") return <Film size={size} aria-hidden="true" />;
  if (type === "document") return <FileText size={size} aria-hidden="true" />;
  if (type === "other") return <Layers size={size} aria-hidden="true" />;
  return <ImageIcon size={size} aria-hidden="true" />;
}

export function MediaVisibilityPill({ visibility }: { visibility: MediaVisibility }) {
  return (
    <span className={`mb-vis mb-vis--${visibility}`}>
      {MEDIA_VISIBILITY_LABEL[visibility]}
    </span>
  );
}

/** Staged image loader: tries each source in order, advancing on
 *  error (or on an already-broken image at hydration). Renders
 *  null once every source is exhausted so callers show their
 *  own fallback. */
export function StagedImage({
  sources,
  alt,
  className,
  eager,
}: {
  sources: Array<string | null>;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const list = sources.filter((s): s is string => !!s);
  const [stage, setStage] = useState(0);
  if (stage >= list.length) return null;
  return (
    <img
      src={list[stage]}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) setStage((s) => s + 1);
      }}
      onError={() => setStage((s) => s + 1)}
    />
  );
}

/** Ordered thumbnail sources: curated → (president) authed proxy →
 *  public Drive service. Share-safe sources only for non-presidents
 *  (the proxy cannot read credentials without a president session). */
export function thumbSources(
  item: MediaItem,
  proxyFirst: boolean,
  width = 800
): Array<string | null> {
  const proxy = `/api/media/thumb?id=${item.id}&w=${width}`;
  const pub = item.driveFileId ? driveThumbnailUrl(item.driveFileId, width) : null;
  return proxyFirst
    ? [item.thumbnailUrl, proxy, pub]
    : [item.thumbnailUrl, pub];
}

/** Grid thumbnail: staged sources → type placeholder (never a
 *  broken-image icon). */
export function MediaThumb({ item, proxyFirst = false }: { item: MediaItem; proxyFirst?: boolean }) {
  const [stage, setStage] = useState(0);
  const list = thumbSources(item, proxyFirst).filter((s): s is string => !!s);
  const advance = () => setStage((s) => s + 1);
  if (stage >= list.length) {
    return (
      <div className={`mb-thumb mb-thumb--${item.mediaType}`} aria-hidden="true">
        <MediaTypeIcon type={item.mediaType} />
      </div>
    );
  }
  return (
    <div className="mb-thumb mb-thumb--img" aria-hidden="true">
      <img
        src={list[stage]}
        alt=""
        loading="lazy"
        ref={(el) => {
          if (el && el.complete && el.naturalWidth === 0) advance();
        }}
        onError={advance}
      />
    </div>
  );
}

function shortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One gallery card → detail. Visual first, minimal text. */
export function MediaCard({
  item,
  proxyFirst = false,
  basePath = "/hub/media",
}: {
  item: MediaItem;
  proxyFirst?: boolean;
  basePath?: string;
}) {
  return (
    <Link href={`${basePath}/${item.id}`} className="mb-card">
      <MediaThumb item={item} proxyFirst={proxyFirst} />
      <span className="mb-card-body">
        <span className="mb-card-top">
          <span className="mb-type">{MEDIA_TYPE_LABEL[item.mediaType]}</span>
          {item.isFeatured && <span className="mb-featured">Featured</span>}
        </span>
        <span className="mb-card-title">{item.title}</span>
        <span className="mb-card-meta">
          {[item.projectTitle, shortDate(item.capturedAt ?? item.createdAt)]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {item.tags.length > 0 && (
          <span className="mb-card-tags">
            {item.tags.slice(0, 3).map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </span>
        )}
      </span>
    </Link>
  );
}
