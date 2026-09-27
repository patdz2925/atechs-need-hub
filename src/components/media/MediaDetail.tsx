"use client";

/* ============================================================
   /hub/media/[id] — detail + manage.
   Big preview first (image thumbnail, safe video preview, or an
   honest "preview unavailable" fallback pointing at Drive), then
   metadata, Drive actions, and the authorized actions: edit,
   archive/restore, feature, remove-from-Bank. The Drive original
   is never touched from here.
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import {
  driveDownloadUrl,
  driveOutboundUrl,
  driveThumbnailUrl,
  MEDIA_TYPE_LABEL,
  type MediaFolder,
  type MediaItem,
} from "@/lib/media/types";
import {
  deleteMedia,
  setMediaArchived,
  setMediaFeatured,
} from "@/lib/media/mutations";
import { canDeleteMedia, canEditMedia, mediaActions } from "@/lib/media/types";
import type { Department, Project } from "@/lib/projects/types";
import type { Role } from "@/lib/roles";
import { MediaTypeIcon, MediaVisibilityPill, thumbSources } from "./MediaBits";
import MediaForm from "./MediaForm";

interface MediaDetailProps {
  role: Role;
  viewerId: string;
  viewerDeptId: string | null;
  item: MediaItem;
  projects: Project[];
  departments: Department[];
  folders: MediaFolder[];
  /** Neighbor rows for the fullscreen lightbox (same folder/project). */
  siblings: MediaItem[];
  /** Detail-link prefix (public gallery uses /media). */
  basePath?: string;
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatBytes(n: number | null): string {
  if (n === null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[u]}`;
}

/** A preview URL is only embedded when it is https AND looks like a
 *  directly playable/streamable video source. */
function safeVideoSrc(item: MediaItem): string | null {
  const url = (item.previewUrl || "").trim();
  if (!url.startsWith("https://")) return null;
  const lower = url.toLowerCase();
  const playable =
    /\.(mp4|webm|ogg)(\?|#|$)/.test(lower) ||
    (item.mimeType ?? "").startsWith("video/");
  return playable ? url : null;
}

export default function MediaDetail({
  role,
  viewerId,
  viewerDeptId,
  item,
  projects,
  departments,
  folders,
  siblings,
  basePath = "/hub/media",
}: MediaDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [previewStage, setPreviewStage] = useState(0);
  // Fullscreen lightbox over the sibling set (current item first).
  const [lightbox, setLightbox] = useState(false);
  const [lightIndex, setLightIndex] = useState(0);

  const editable = canEditMedia(role, viewerId, viewerDeptId, item);
  const featurable = mediaActions(role).feature;
  const deletable = canDeleteMedia(role);
  const outbound = driveOutboundUrl(item);
  const videoSrc = item.mediaType === "video" ? safeVideoSrc(item) : null;
  const previewList = thumbSources(item, role === "president").filter(
    (s): s is string => !!s
  );
  const previewSrc = previewStage < previewList.length ? previewList[previewStage] : null;
  const advancePreview = () => setPreviewStage((s) => s + 1);

  // Lightbox ordering: siblings in fetch order, current item pinned.
  // Siblings arrive RLS-scoped, so navigation never leaks rows.
  const lightItems = (() => {
    const rest = siblings.filter((s) => s.id !== item.id);
    return [item, ...rest];
  })();

  function openLightbox() {
    setLightIndex(0);
    setLightbox(true);
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function copyLink() {
    if (!outbound) return;
    try {
      await navigator.clipboard.writeText(outbound);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link in this browser.");
    }
  }

  return (
    <>
      <Link href={basePath} className="pj-back">
        <ChevronLeft size={14} aria-hidden="true" />
        All media
      </Link>

      {item.status === "archived" && (
        <div className="pj-banner" role="status">
          <span>
            <strong>Archived</strong> — hidden from normal browsing, Drive original untouched.
          </span>
        </div>
      )}

      <div className="mb-detail">
        <section className="panel mb-preview-pane">
          {item.mediaType === "image" && previewSrc ? (
            <button
              type="button"
              className="mb-preview-open"
              onClick={openLightbox}
              aria-label={`Open fullscreen preview of ${item.title}`}
            >
              <img
                src={previewSrc}
                alt={item.title}
                className="mb-preview-img mb-preview-img--zoom"
                loading="lazy"
                ref={(el) => {
                  if (el && el.complete && el.naturalWidth === 0) advancePreview();
                }}
                onError={advancePreview}
              />
            </button>
          ) : videoSrc ? (
            <video src={videoSrc} controls preload="metadata" className="mb-preview-img" />
          ) : (
            <div className="mb-preview-fallback" role="img" aria-label={`${MEDIA_TYPE_LABEL[item.mediaType]} preview unavailable`}>
              <MediaTypeIcon type={item.mediaType} size={64} />
              <p>Preview unavailable.</p>
              {outbound ? (
                <a
                  href={outbound}
                  target="_blank"
                  rel="noreferrer"
                  className="pj-btn pj-btn--primary"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Open in Google Drive
                </a>
              ) : (
                <p className="pj-note">No viewable source was registered for this file.</p>
              )}
            </div>
          )}
        </section>

        <div className="mb-detail-side">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="pj-pills" style={{ marginBottom: "0.5rem" }}>
                  <span className="mb-type">{MEDIA_TYPE_LABEL[item.mediaType]}</span>
                  <MediaVisibilityPill visibility={item.visibility} />
                  {item.isFeatured && <span className="mb-featured">Featured</span>}
                  {item.status === "archived" && <span className="pill">Archived</span>}
                </div>
                <h2 style={{ fontSize: "1.4rem" }}>{item.title}</h2>
                {item.description && <p className="pj-detail-sub">{item.description}</p>}
              </div>
            </div>

            <div className="pj-facts">
              <div className="pj-fact">
                <div className="k">Project</div>
                <div className="v">
                  {item.projectId ? (
                    <Link href={`/hub/projects/${item.projectId}`}>
                      {item.projectTitle || "Project"}
                    </Link>
                  ) : (
                    <span className="muted">{item.eventName || "—"}</span>
                  )}
                </div>
              </div>
              <div className="pj-fact">
                <div className="k">Department</div>
                <div className="v">{item.departmentName || "—"}</div>
              </div>
              <div className="pj-fact">
                <div className="k">Captured</div>
                <div className="v">{fmt(item.capturedAt)}</div>
              </div>
              <div className="pj-fact">
                <div className="k">Uploaded by</div>
                <div className="v">{item.uploaderName || "—"}</div>
              </div>
              <div className="pj-fact">
                <div className="k">File</div>
                <div className="v">
                  {[item.fileName, item.mimeType, formatBytes(item.fileSize)]
                    .filter((x) => x && x !== "—")
                    .join(" · ") || "—"}
                </div>
              </div>
              <div className="pj-fact">
                <div className="k">Location</div>
                <div className="v">{item.location || "—"}</div>
              </div>
            </div>

            {item.tags.length > 0 && (
              <div className="pj-tags pj-tags--roomy" style={{ marginTop: "1rem" }}>
                {item.tags.map((t) => (
                  <Link key={t} href={`/hub/media?tag=${encodeURIComponent(t)}`} className="pj-tag">
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            <div className="pj-form-actions" style={{ marginTop: "1.25rem" }}>
              {outbound && (
                <a href={outbound} target="_blank" rel="noreferrer" className="pj-btn pj-btn--primary">
                  <ExternalLink size={14} aria-hidden="true" />
                  Open in Google Drive
                </a>
              )}
              {item.driveFileId && (
                <a
                  href={driveDownloadUrl(item.driveFileId)}
                  target="_blank"
                  rel="noreferrer"
                  className="pj-btn"
                >
                  <Download size={14} aria-hidden="true" />
                  Download
                </a>
              )}
              {outbound && (
                <button type="button" className="pj-btn" onClick={() => void copyLink()}>
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              )}
            </div>
            {error && (
              <p className="pj-err" role="alert" style={{ marginTop: "0.75rem" }}>
                {error}
              </p>
            )}
          </section>

          {(editable || featurable || deletable) && !editing && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Manage</h2>
                  <span className="panel-hint">Metadata, visibility, archive</span>
                </div>
              </div>
              <div className="pj-form-actions">
                {editable && (
                  <button type="button" className="pj-btn" onClick={() => setEditing(true)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit metadata
                  </button>
                )}
                {featurable && (
                  <button
                    type="button"
                    className="pj-btn"
                    disabled={busy}
                    onClick={() => void run(() => setMediaFeatured(item.id, !item.isFeatured))}
                  >
                    {item.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                )}
                {editable && (
                  <button
                    type="button"
                    className="pj-btn"
                    disabled={busy}
                    onClick={() => void run(() => setMediaArchived(item.id, item.status !== "archived"))}
                  >
                    {item.status === "archived" ? "Restore" : "Archive"}
                  </button>
                )}
                {deletable && !confirmingDelete && (
                  <button
                    type="button"
                    className="pj-btn pj-btn--danger"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Remove
                  </button>
                )}
                {deletable && confirmingDelete && (
                  <span className="pj-confirm">
                    <span className="pj-confirm-label">
                      Remove from Media Bank? (Drive original stays)
                    </span>
                    <button
                      type="button"
                      className="pj-btn pj-btn--danger"
                      disabled={busy}
                      onClick={() =>
                        void run(() => deleteMedia(item.id)).then((ok) => {
                          if (ok) router.push("/hub/media");
                        })
                      }
                    >
                      {busy ? "Removing…" : "Confirm remove"}
                    </button>
                    <button
                      type="button"
                      className="pj-btn"
                      disabled={busy}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
              <p className="pj-note" style={{ marginTop: "0.75rem" }}>
                Removing deletes only the Bank index — never the Drive original.
              </p>
            </section>
          )}
        </div>
      </div>

      {editing && (
        <section className="panel" style={{ marginTop: "1.25rem" }}>
          <div className="panel-head">
            <div>
              <h2>Edit metadata</h2>
            </div>
          </div>
          <MediaForm
            mode="edit"
            viewerId={viewerId}
            projects={projects}
            departments={departments}
            folders={folders}
            initial={item}
            canFeature={featurable}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}

      {lightbox && (
        <MediaLightbox
          items={lightItems}
          index={lightIndex}
          proxyFirst={role === "president"}
          onClose={() => setLightbox(false)}
          onIndex={setLightIndex}
        />
      )}
    </>
  );
}

/* Fullscreen gallery over RLS-scoped siblings: staged large sources,
   prev/next buttons + arrow keys (parent) + swipe, Drive actions,
   backdrop-click/Esc to close. */
function MediaLightbox({
  items,
  index,
  proxyFirst,
  onClose,
  onIndex,
}: {
  items: MediaItem[];
  index: number;
  proxyFirst: boolean;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const [at, setAt] = useState(index);
  const [stage, setStage] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const current = items[at] ?? items[0];
  if (!current) return null;

  const go = (dir: 1 | -1) => {
    const next = (at + dir + items.length) % items.length;
    setAt(next);
    setStage(0);
    onIndex(next);
  };

  // Large sources for fullscreen: curated preview → (president)
  // authed proxy → Drive service. Videos stay inline-only.
  const list =
    current.mediaType === "image"
      ? [
          current.previewUrl,
          ...(proxyFirst ? [`/api/media/thumb?id=${current.id}&w=1600`] : []),
          current.driveFileId ? driveThumbnailUrl(current.driveFileId, 1920) : null,
        ].filter((s): s is string => !!s)
      : [];
  const src = stage < list.length ? list[stage] : null;
  const outbound = driveOutboundUrl(current);

  return (
    <div
      className="mb-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      tabIndex={-1}
      ref={(el) => {
        el?.focus({ preventScroll: true });
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        setTouchX(null);
        if (dx > 40) go(-1);
        else if (dx < -40) go(1);
      }}
    >
      <button type="button" className="mb-lightbox-close" onClick={onClose} aria-label="Close preview">
        <X size={22} aria-hidden="true" />
      </button>
      {items.length > 1 && (
        <button
          type="button"
          className="mb-lightbox-nav mb-lightbox-prev"
          onClick={() => go(-1)}
          aria-label="Previous media"
        >
          <ChevronLeft size={26} aria-hidden="true" />
        </button>
      )}
      <figure className="mb-lightbox-fig">
        {src ? (
          <img
            src={src}
            alt={current.title}
            ref={(el) => {
              if (el && el.complete && el.naturalWidth === 0) setStage((s) => s + 1);
            }}
            onError={() => setStage((s) => s + 1)}
          />
        ) : (
          <div className="mb-preview-fallback">
            <MediaTypeIcon type={current.mediaType} size={64} />
            <p>Preview unavailable.</p>
          </div>
        )}
        <figcaption>
          <strong>{current.title}</strong>
          <span>
            {current.projectTitle || current.eventName || "Media Bank"}
            {" · "}
            {at + 1} / {items.length}
          </span>
          <span className="mb-lightbox-actions">
            {outbound && (
              <a href={outbound} target="_blank" rel="noreferrer" className="pj-btn">
                <ExternalLink size={14} aria-hidden="true" />
                Open Original
              </a>
            )}
            {current.driveFileId && (
              <a
                href={driveDownloadUrl(current.driveFileId)}
                target="_blank"
                rel="noreferrer"
                className="pj-btn"
              >
                <Download size={14} aria-hidden="true" />
                Download
              </a>
            )}
          </span>
        </figcaption>
      </figure>
      {items.length > 1 && (
        <button
          type="button"
          className="mb-lightbox-nav mb-lightbox-next"
          onClick={() => go(1)}
          aria-label="Next media"
        >
          <ChevronRight size={26} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
