"use client";

/* ============================================================
   /hub/media — searchable, filterable, paginated archive grid.
   First page renders server-side; "Load more" appends further
   pages through the SAME shared filter builder over the browser
   client (no duplicated query logic, no full-library fetch).
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, SearchX } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { applyMediaFilters, pageRange, type MediaQuery, type RangedMediaQuery } from "@/lib/media/filters";
import { getSubtreeIds } from "@/lib/media/folders";
import { friendlyReadError } from "@/lib/media/mutations";
import {
  DEFAULT_MEDIA_FILTERS,
  MEDIA_PAGE_SIZE,
  MEDIA_SORT_LABEL,
  MEDIA_TYPE_LABEL,
  toMediaItem,
  type MediaFilters,
  type MediaItem,
  type MediaRow,
  type MediaSortKey,
  type MediaType,
} from "@/lib/media/types";
import type { Department, Project } from "@/lib/projects/types";
import { MediaCard } from "./MediaBits";

const MEDIA_SELECT = `
  id, title, description, media_type, mime_type, file_name, file_size,
  drive_file_id, drive_url, drive_folder_id, media_folder_id,
  drive_created_at, drive_modified_at, last_synced_at,
  thumbnail_url, preview_url,
  project_id, department_id, uploaded_by, captured_at, created_at,
  updated_at, visibility, status, tags, location, event_name, is_featured,
  projects ( id, title, department_id ),
  departments ( id, name )
`;

/** Stable signature of a server payload: changes only when the
 *  server actually sends a new folder/search context. */
function gridKey(filters: MediaFilters, total: number, items: MediaItem[]): string {
  return `${JSON.stringify(filters)}|${total}|${items.map((i) => i.id).join(",")}`;
}

interface MediaGridProps {
  initialItems: MediaItem[];
  initialTotal: number;
  pageSize: number;
  initialFilters: MediaFilters;
  projects: Project[];
  departments: Department[];
  canCreate: boolean;
  /** Presidents stream private thumbs through the authed proxy. */
  proxyThumbs?: boolean;
  /** Detail-link prefix (public gallery uses /media). */
  basePath?: string;
  loadError: string | null;
}

export default function MediaGrid({
  initialItems,
  initialTotal,
  pageSize,
  initialFilters,
  projects,
  departments,
  canCreate,
  proxyThumbs = false,
  basePath = "/hub/media",
  loadError,
}: MediaGridProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<MediaFilters>(initialFilters);
  const [items, setItems] = useState<MediaItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");

  // Client-side navigation between folders/search presets reuses this
  // component instance with FRESH server props — but useState does not
  // re-initialize. Without this sync the grid keeps showing the
  // PREVIOUS folder's rows under the new folder's breadcrumbs (stale
  // gallery bug). The key changes only when the server payload does,
  // so typing in the toolbar never resets mid-search.
  const [appliedKey, setAppliedKey] = useState(() =>
    gridKey(initialFilters, initialTotal, initialItems)
  );
  const incomingKey = gridKey(initialFilters, initialTotal, initialItems);
  useEffect(() => {
    if (incomingKey !== appliedKey) {
      setFilters(initialFilters);
      setItems(initialItems);
      setTotal(initialTotal);
      setPage(1);
      setMoreError("");
      setAppliedKey(incomingKey);
    }
  }, [incomingKey, appliedKey, initialFilters, initialItems, initialTotal]);

  const set = <K extends keyof MediaFilters>(key: K, value: MediaFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  /** Folder views scope to the whole subtree (mirrors server
   *  getMediaPage — same helper, same semantics). Returns null for
   *  unscoped browsing. NOTE: this resolves ID lists only — it must
   *  NEVER return a postgrest builder, because awaiting a builder
   *  executes it (builders are thenable) and resolves to a plain
   *  response object instead. */
  async function folderScopeIds(
    supa: NonNullable<ReturnType<typeof getBrowserSupabase>>,
    folderId: MediaFilters["folderId"]
  ): Promise<string[] | null> {
    if (folderId === "all") return null;
    const { data: tree } = await supa
      .from("media_folders")
      .select("id, parent_id")
      .limit(1000);
    return getSubtreeIds(
      ((tree ?? []) as unknown as Array<{ id: string; parent_id: string | null }>),
      folderId
    ).slice(0, 1000);
  }

  /** Fresh builder with the folder scope already applied. */
  function scopedBase(
    supa: NonNullable<ReturnType<typeof getBrowserSupabase>>,
    f: MediaFilters,
    scopeIds: string[] | null
  ): RangedMediaQuery {
    const base = supa.from("media").select(MEDIA_SELECT, { count: "exact" });
    if (!scopeIds) return base as unknown as RangedMediaQuery;
    return base.in("media_folder_id", scopeIds) as unknown as RangedMediaQuery;
  }

  /* A filter change restarts client-side from page 1 — but the counts
     and the first page the user sees came from the server render, so
     refetch immediately through the browser client for consistency. */
  async function refetch(next: MediaFilters) {
    setFilters(next);
    setMoreError("");
    const supa = getBrowserSupabase();
    if (!supa) {
      setMoreError("Supabase isn't configured.");
      return;
    }
    const { from, to } = pageRange(1, pageSize);
    const base = scopedBase(supa, next, await folderScopeIds(supa, next.folderId));
    const { data, error, count } = await applyMediaFilters(base, next).range(from, to);
    if (error) {
      setMoreError(friendlyReadError(error.message));
      return;
    }
    setItems(((data ?? []) as unknown as MediaRow[]).map((r) => toMediaItem(r)));
    setTotal(count ?? 0);
    setPage(1);
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const supa = getBrowserSupabase();
      if (!supa) throw new Error("Supabase isn't configured.");
      const { from, to } = pageRange(page + 1, pageSize);
      const base = scopedBase(supa, filters, await folderScopeIds(supa, filters.folderId));
      const { data, error, count } = await applyMediaFilters(base, filters).range(from, to);
      // PostgREST answers off-the-end ranges with 416/PGRST103, NOT an
      // exception: rows vanished (or were never visible) between pages.
      // That is end-of-data — clamp quietly instead of alarming.
      // NOTE: response errors are plain objects (not Error instances),
      // so they are handled here — never via throw.
      if (error && (error as { code?: string }).code === "PGRST103") {
        setTotal(items.length);
        return;
      }
      if (error) {
        setMoreError(friendlyReadError(error.message));
        return;
      }
      const rows = ((data ?? []) as unknown as MediaRow[]).map((r) => toMediaItem(r));
      setItems((cur) => [...cur, ...rows]);
      setTotal(count ?? total);
      setPage((p) => p + 1);
    } catch (e) {
      // Genuine throwables (network, etc.) — PostgREST response errors
      // are handled above, never reach here.
      setMoreError(
        e instanceof Error ? friendlyReadError(e.message) : "Could not load more media."
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const hasFilters = useMemo(
    () =>
      filters.query.trim() !== "" ||
      filters.type !== "all" ||
      filters.projectId !== "all" ||
      filters.departmentId !== "all" ||
      filters.tag.trim() !== "" ||
      filters.dateFrom !== "" ||
      filters.dateTo !== "" ||
      filters.featured ||
      filters.status !== "active",
    [filters]
  );

  // Clearing resets search facets but STAYS inside the current folder.
  const clearFilters = () =>
    void refetch({ ...DEFAULT_MEDIA_FILTERS, sort: filters.sort, folderId: filters.folderId });

  if (loadError) {
    return (
      <div className="pj-alert" role="alert">
        <span>
          Couldn&rsquo;t load media: <strong>{loadError}</strong>
        </span>
        <button type="button" className="pj-btn" onClick={() => router.refresh()}>
          Retry
        </button>
      </div>
    );
  }

  const remaining = total - items.length;

  return (
    <>
      <div className="pj-toolbar">
        <input
          className="pj-search"
          type="search"
          placeholder="Search title, description, file name, tag…"
          aria-label="Search media"
          value={filters.query}
          onChange={(e) => void refetch({ ...filters, query: e.target.value })}
        />
        <select
          className="pj-select"
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => void refetch({ ...filters, type: e.target.value as "all" | MediaType })}
        >
          <option value="all">All types</option>
          {(Object.keys(MEDIA_TYPE_LABEL) as MediaType[]).map((t) => (
            <option key={t} value={t}>
              {t === "image" ? "Photos" : `${MEDIA_TYPE_LABEL[t]}s`}
            </option>
          ))}
        </select>
        {projects.length > 0 && (
          <select
            className="pj-select"
            aria-label="Filter by project"
            value={filters.projectId}
            onChange={(e) => void refetch({ ...filters, projectId: e.target.value })}
          >
            <option value="all">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        {departments.length > 0 && (
          <select
            className="pj-select"
            aria-label="Filter by department"
            value={filters.departmentId}
            onChange={(e) => void refetch({ ...filters, departmentId: e.target.value })}
          >
            <option value="all">Any department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <input
          className="pj-search"
          type="search"
          placeholder="#tag"
          aria-label="Filter by tag"
          value={filters.tag}
          onChange={(e) => void refetch({ ...filters, tag: e.target.value })}
          style={{ maxWidth: "10rem" }}
        />
        <select
          className="pj-select"
          aria-label="Sort media"
          value={filters.sort}
          onChange={(e) => void refetch({ ...filters, sort: e.target.value as MediaSortKey })}
        >
          {(Object.keys(MEDIA_SORT_LABEL) as MediaSortKey[]).map((s) => (
            <option key={s} value={s}>
              {MEDIA_SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="pj-toolbar pj-toolbar--secondary">
        <label className="mb-date">
          From{" "}
          <input
            type="date"
            aria-label="Captured from date"
            value={filters.dateFrom}
            onChange={(e) => void refetch({ ...filters, dateFrom: e.target.value })}
          />
        </label>
        <label className="mb-date">
          To{" "}
          <input
            type="date"
            aria-label="Captured to date"
            value={filters.dateTo}
            onChange={(e) => void refetch({ ...filters, dateTo: e.target.value })}
          />
        </label>
        <label className="mb-check">
          <input
            type="checkbox"
            checked={filters.featured}
            onChange={(e) => void refetch({ ...filters, featured: e.target.checked })}
          />
          Featured only
        </label>
        <select
          className="pj-select"
          aria-label="Record status"
          value={filters.status}
          onChange={(e) =>
            void refetch({ ...filters, status: e.target.value as MediaFilters["status"] })
          }
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">Active + archived</option>
        </select>
        {hasFilters && (
          <button type="button" className="pj-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <p className="pj-count">
        Showing {items.length} of {total} {total === 1 ? "item" : "items"}
      </p>

      {items.length ? (
        <>
          <div className="mb-grid">
            {items.map((m) => (
              <MediaCard key={m.id} item={m} proxyFirst={proxyThumbs} basePath={basePath} />
            ))}
          </div>
          {moreError && (
            <p className="pj-err" role="alert">
              {moreError}
            </p>
          )}
          {remaining > 0 && (
            <div className="mb-more">
              <button
                type="button"
                className="pj-btn"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading…" : `Load more (${remaining} remaining)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="pj-empty">
          <span className="pj-empty-icon" aria-hidden="true">
            {filters.query.trim() || hasFilters ? <SearchX size={24} /> : <ImagePlus size={24} />}
          </span>
          <h3>{filters.query.trim() || hasFilters ? "No media matched your search" : "No media yet"}</h3>
          <p>
            {filters.query.trim() || hasFilters
              ? "Try different keywords, fewer filters, or another project."
              : canCreate
                ? "Register the first Drive file or folder to start the archive."
                : "Media appears here once contributors register it."}
          </p>
          {canCreate && !hasFilters && !filters.query.trim() && (
            <Link href="/hub/media/new" className="pj-btn pj-btn--primary">
              Register media
            </Link>
          )}
        </div>
      )}
    </>
  );
}
