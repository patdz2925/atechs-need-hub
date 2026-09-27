/* ============================================================
   Media Bank — shared filter → query builder.
   PURE module (no Supabase client imports): the postgrest-js
   chainable API is identical on the server and browser clients,
   so both sides build the SAME query from the SAME filters.
   Server pagination (range + exact count) keeps the archive fast
   at thousands of rows — never ship the whole library.
   ============================================================ */

import type { MediaFilters } from "./types";

/** Structural subset of the postgrest-js chain used here. */
export interface MediaQuery {
  ilike(column: string, pattern: string): MediaQuery;
  eq(column: string, value: unknown): MediaQuery;
  contains(column: string, value: unknown): MediaQuery;
  gte(column: string, value: string): MediaQuery;
  lt(column: string, value: string): MediaQuery;
  or(filters: string): MediaQuery;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ): MediaQuery;
}

/** A filtered builder ready for server-side pagination. Call sites
 *  cast the concrete builder to this (via unknown) to avoid
 *  postgrest-js deep-type instantiation. */
export interface RangedMediaQuery extends MediaQuery {
  range(
    from: number,
    to: number
  ): Promise<{ data: unknown; error: { message: string } | null; count: number | null }>;
}

/** Strip postgrest/ilike metacharacters so user input can't break
 *  the filter string. */
function escapeIlike(q: string): string {
  return q.replace(/[%(),\\"]/g, "").trim();
}

export function applyMediaFilters<Q extends MediaQuery>(query: Q, f: MediaFilters): Q {
  let q: MediaQuery = query;

  // Active browsing hides archived rows (archive management opts in).
  if (f.status === "active") q = q.eq("status", "active");
  else if (f.status === "archived") q = q.eq("status", "archived");

  if (f.type !== "all") q = q.eq("media_type", f.type);
  if (f.projectId !== "all") q = q.eq("project_id", f.projectId);
  if (f.departmentId !== "all") q = q.eq("department_id", f.departmentId);
  // NOTE: folder scoping is NOT applied here on purpose. Folder views
  // cover whole subtrees (see getSubtreeIds) and both call sites
  // (server getMediaPage, client MediaGrid) resolve the subtree ids
  // first, then .in() them. An exact eq() here would silently shrink
  // every folder view to direct children only.
  if (f.featured) q = q.eq("is_featured", true);

  const tag = f.tag.trim().toLowerCase();
  if (tag) q = q.contains("tags", [tag]);

  const queryText = escapeIlike(f.query);
  if (queryText) {
    const like = `%${queryText}%`;
    // Title / description / file name substring + exact tag match
    // (single tokens only — commas/braces would corrupt the group).
    const token = /^[a-z0-9][a-z0-9-]*$/i.test(queryText) ? queryText.toLowerCase() : null;
    q = q.or(
      [
        `title.ilike.${like}`,
        `description.ilike.${like}`,
        `file_name.ilike.${like}`,
        ...(token ? [`tags.cs.{${token}}`] : []),
      ].join(",")
    );
  }

  if (f.dateFrom) q = q.gte("captured_at", f.dateFrom);
  if (f.dateTo) {
    const end = new Date(`${f.dateTo}T00:00:00Z`);
    if (!Number.isNaN(end.getTime())) {
      q = q.lt("captured_at", new Date(end.getTime() + 86_400_000).toISOString());
    }
  }

  switch (f.sort) {
    case "oldest":
      q = q.order("captured_at", { ascending: true, nullsFirst: false });
      break;
    case "title":
      q = q.order("title", { ascending: true });
      break;
    case "recently_added":
      q = q.order("created_at", { ascending: false });
      break;
    case "newest":
    default:
      q = q.order("captured_at", { ascending: false, nullsFirst: false });
      break;
  }

  return q as Q;
}

/** Zero-based inclusive range for postgrest .range(). */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const p = Math.max(1, Math.floor(page) || 1);
  return { from: (p - 1) * pageSize, to: p * pageSize - 1 };
}
