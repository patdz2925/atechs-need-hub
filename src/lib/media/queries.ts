/* ============================================================
   Media Bank module — server-side queries (App Router components).
   Cookie-authenticated server client, publishable key only.
   RLS decides visibility; these never bypass it. Search, filters
   and pagination run in the DATABASE (never ship the library).
   ============================================================ */

import { createServerSupabase } from "@/lib/supabase/server";
import { applyMediaFilters, pageRange, type MediaQuery } from "./filters";
import {
  toMediaFolder,
  toMediaItem,
  type MediaFilters,
  type MediaFolder,
  type MediaFolderRow,
  type MediaItem,
  type MediaRow,
  type MediaType,
} from "./types";
import { getSubtreeIds } from "./folders";

const FOLDER_SELECT = `
  id, drive_folder_id, parent_id, name, project_id, department_id,
  visibility, created_at, updated_at, last_synced_at,
  projects ( id, title )
`;

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

interface MediaRowWithEmbeds extends MediaRow {
  projects: { id: string; title: string; department_id: string | null } | null;
  departments: { id: string; name: string } | null;
}

function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "Database schema out of date — run supabase/media-bank.sql in the Supabase SQL Editor, then retry.";
  }
  if (m.includes("row-level security")) return "You don't have permission to view this media.";
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
  error: string | null;
}

/** Server-paginated, server-filtered media search. */
export async function getMediaPage(
  filters: MediaFilters,
  page: number,
  pageSize: number
): Promise<MediaPage> {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return { items: [], total: 0, page, pageSize, error: "Supabase isn't configured." };
  }

  const { from, to } = pageRange(page, pageSize);
  const base = supabase.from("media").select(MEDIA_SELECT, { count: "exact" });
  // Folder views scope to the whole SUBTREE (folder + descendants),
  // never to sibling trees. Unknown ids self-scope (match nothing).
  let scoped = base;
  if (filters.folderId !== "all") {
    const { data: tree } = await supabase
      .from("media_folders")
      .select("id, parent_id")
      .limit(1000);
    const ids = getSubtreeIds(
      ((tree ?? []) as unknown as Array<{ id: string; parent_id: string | null }>),
      filters.folderId
    );
    scoped = base.in("media_folder_id", ids.slice(0, 1000)) as typeof base;
  }
  // Boundary casts: the shared builder is typed structurally so both
  // clients reuse it; the concrete range()/await shape stays intact.
  const filtered = applyMediaFilters(scoped as unknown as MediaQuery, filters) as unknown as typeof base;
  const { data, error, count } = await filtered.range(from, to);

  if (error) {
    console.warn("[media] page query failed:", error.message);
    return { items: [], total: 0, page, pageSize, error: humanize(error.message) };
  }
  return {
    items: ((data ?? []) as unknown as MediaRowWithEmbeds[]).map((r) => toMediaItem(r)),
    total: count ?? 0,
    page,
    pageSize,
    error: null,
  };
}

/** One record. `item: null` + `error: null` ⇒ not found (or invisible). */
export async function getMediaItem(
  id: string
): Promise<{ item: MediaItem | null; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { item: null, error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media")
    .select(MEDIA_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[media] detail query failed:", error.message);
    return { item: null, error: humanize(error.message) };
  }
  if (!data) return { item: null, error: null };
  return { item: toMediaItem(data as unknown as MediaRowWithEmbeds), error: null };
}

/** Recent active rows for one project (project detail → Media). */
export async function getProjectMedia(
  projectId: string,
  limit = 6
): Promise<{ items: MediaItem[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { items: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media")
    .select(MEDIA_SELECT)
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("captured_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.warn("[media] project query failed:", error.message);
    return { items: [], error: humanize(error.message) };
  }
  return {
    items: ((data ?? []) as unknown as MediaRowWithEmbeds[]).map((r) => toMediaItem(r)),
    error: null,
  };
}

/** Featured rows for the homepage strip + dashboard (RLS-scoped). */
export async function getFeaturedMedia(
  limit = 4
): Promise<{ items: MediaItem[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { items: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media")
    .select(MEDIA_SELECT)
    .eq("status", "active")
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[media] featured query failed:", error.message);
    return { items: [], error: humanize(error.message) };
  }
  return {
    items: ((data ?? []) as unknown as MediaRowWithEmbeds[]).map((r) => toMediaItem(r)),
    error: null,
  };
}

/** Active-row counts per type for the homepage category cards. */
export async function getMediaTypeCounts(): Promise<{
  counts: Record<MediaType, number>;
  error: string | null;
}> {
  const supabase = await createServerSupabase();
  const zero = { image: 0, video: 0, document: 0, other: 0 };
  if (!supabase) return { counts: zero, error: "Supabase isn't configured." };

  const types: MediaType[] = ["image", "video", "document", "other"];
  const results = await Promise.all(
    types.map((t) =>
      supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("media_type", t)
    )
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    console.warn("[media] counts query failed:", firstError.message);
    return { counts: zero, error: humanize(firstError.message) };
  }
  const counts = { ...zero };
  results.forEach((r, i) => {
    counts[types[i]] = r.count ?? 0;
  });
  return { counts, error: null };
}

/** Total active rows for dashboard tiles (RLS-scoped head count). */
export async function getMediaTotal(): Promise<{ total: number; error: string | null }> {  const supabase = await createServerSupabase();
  if (!supabase) return { total: 0, error: "Supabase isn't configured." };

  const { count, error } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    console.warn("[media] total query failed:", error.message);
    return { total: 0, error: humanize(error.message) };
  }
  return { total: count ?? 0, error: null };
}

/** Recent active rows for the dashboard widget (RLS-scoped). */
export async function getRecentMedia(
  limit = 4
): Promise<{ items: MediaItem[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { items: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media")
    .select(MEDIA_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[media] recent query failed:", error.message);
    return { items: [], error: humanize(error.message) };
  }
  return {
    items: ((data ?? []) as unknown as MediaRowWithEmbeds[]).map((r) => toMediaItem(r)),
    error: null,
  };
}

/* ============================================================
   Folders — hierarchy reads (RLS-scoped like media rows).
   ============================================================ */

interface FolderRowWithProject extends MediaFolderRow {
  projects: { id: string; title: string } | null;
}

/** One folder by id (null when invisible). */
export async function getMediaFolder(
  id: string
): Promise<{ folder: MediaFolder | null; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { folder: null, error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media_folders")
    .select(FOLDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[media] folder query failed:", error.message);
    return { folder: null, error: humanize(error.message) };
  }
  if (!data) return { folder: null, error: null };
  const row = data as unknown as FolderRowWithProject;
  return {
    folder: {
      ...toMediaFolder(row),
      path: [],
      mediaCount: 0,
      childCount: 0,
      covers: [],
    },
    error: null,
  };
}

/** Breadcrumb chain root → folder (each hop RLS-checked). */
export async function getFolderPath(
  id: string
): Promise<{ path: Array<{ id: string; name: string }>; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { path: [], error: "Supabase isn't configured." };

  const path: Array<{ id: string; name: string }> = [];
  let current: string | null = id;
  let guard = 0;
  while (current && guard < 25) {
    guard += 1;
    const { data, error } = await supabase
      .from("media_folders")
      .select("id, name, parent_id")
      .eq("id", current)
      .maybeSingle();
    if (error) {
      console.warn("[media] folder path query failed:", error.message);
      return { path: [], error: humanize(error.message) };
    }
    if (!data) break;
    const row = data as unknown as { id: string; name: string; parent_id: string | null };
    path.unshift({ id: row.id, name: row.name });
    current = row.parent_id;
  }
  return { path, error: null };
}

export interface FolderCardData extends MediaFolder {
  mediaCount: number;
  childCount: number;
  covers: string[];
}

/** Attach subtree media counts (+ optional covers) to folder rows.
 *  Counts cover the whole subtree so parents report honest totals;
 *  covers stay direct-folder thumbnails (the folder's own face). */
async function hydrateFolderCards(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
  rows: FolderRowWithProject[],
  withCovers: boolean
): Promise<FolderCardData[]> {
  if (!rows.length) return [];

  const { data: tree } = await supabase
    .from("media_folders")
    .select("id, parent_id")
    .limit(1000);
  const all = (tree ?? []) as unknown as Array<{ id: string; parent_id: string | null }>;
  const sets = rows.map((r) => new Set(getSubtreeIds(all, r.id)));
  const union = [...new Set(sets.flatMap((s) => [...s]))].slice(0, 1000);

  const [mediaRows, coverRows] = await Promise.all([
    union.length
      ? supabase
          .from("media")
          .select("media_folder_id")
          .in("media_folder_id", union)
          .eq("status", "active")
          .limit(5000)
      : Promise.resolve({ data: [] as unknown[] }),
    withCovers
      ? supabase
          .from("media")
          .select("media_folder_id, thumbnail_url, drive_file_id")
          .in(
            "media_folder_id",
            rows.map((r) => r.id)
          )
          .eq("status", "active")
          .order("captured_at", { ascending: false, nullsFirst: false })
          .limit(Math.min(rows.length * 12, 600))
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const counts = new Map<string, number>();
  for (const m of (mediaRows.data ?? []) as unknown as Array<{ media_folder_id: string | null }>) {
    if (!m.media_folder_id) continue;
    counts.set(m.media_folder_id, (counts.get(m.media_folder_id) ?? 0) + 1);
  }

  const coversByFolder = new Map<string, string[]>();
  for (const c of (coverRows.data ?? []) as unknown as Array<{
    media_folder_id: string | null;
    thumbnail_url: string | null;
    drive_file_id: string | null;
  }>) {
    if (!c.media_folder_id) continue;
    const list = coversByFolder.get(c.media_folder_id) ?? [];
    if (list.length >= 4) continue;
    const thumb =
      c.thumbnail_url ??
      (c.drive_file_id ? `https://drive.google.com/thumbnail?id=${c.drive_file_id}&sz=w400` : null);
    if (thumb) list.push(thumb);
    coversByFolder.set(c.media_folder_id, list);
  }

  // Direct-child counts come straight from the tree (no queries).
  const childCounts = new Map<string, number>();
  for (const f of all) {
    if (!f.parent_id) continue;
    childCounts.set(f.parent_id, (childCounts.get(f.parent_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const set = sets[rows.indexOf(r)];
    let total = 0;
    for (const fid of set) total += counts.get(fid) ?? 0;
    return {
      ...toMediaFolder(r),
      path: [],
      mediaCount: total,
      childCount: childCounts.get(r.id) ?? 0,
      covers: coversByFolder.get(r.id) ?? [],
    };
  });
}

/** Child folders of a parent (null = roots), each with subtree
 *  counts + cover thumbnails. */
export async function getChildFolders(
  parentId: string | null
): Promise<{ folders: FolderCardData[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { folders: [], error: "Supabase isn't configured." };

  let query = supabase.from("media_folders").select(FOLDER_SELECT).order("name");
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data, error } = await query;
  if (error) {
    console.warn("[media] child folders query failed:", error.message);
    return { folders: [], error: humanize(error.message) };
  }
  const rows = (data ?? []) as unknown as FolderRowWithProject[];
  return { folders: await hydrateFolderCards(supabase, rows, true), error: null };
}

/** Folder-name search for the explorer (RLS-scoped). */
export async function searchMediaFolders(
  query: string,
  limit = 8
): Promise<{ folders: FolderCardData[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { folders: [], error: "Supabase isn't configured." };
  const q = query.replace(/[%(),\\"]/g, "").trim();
  if (!q) return { folders: [], error: null };

  const { data, error } = await supabase
    .from("media_folders")
    .select(FOLDER_SELECT)
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(limit);
  if (error) {
    console.warn("[media] folder search failed:", error.message);
    return { folders: [], error: humanize(error.message) };
  }
  const rows = (data ?? []) as unknown as FolderRowWithProject[];
  return {
    folders: await hydrateFolderCards(supabase, rows, false),
    error: null,
  };
}

/** Siblings for the lightbox: same subtree, else same project. */
export async function getMediaSiblings(
  item: Pick<MediaItem, "id" | "projectId"> & { folderId: string | null },
  limit = 100
): Promise<{ items: MediaItem[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { items: [], error: "Supabase isn't configured." };

  let scope: string[] | null = null;
  if (item.folderId != null) {
    const { data: tree } = await supabase
      .from("media_folders")
      .select("id, parent_id")
      .limit(1000);
    scope = getSubtreeIds(
      ((tree ?? []) as unknown as Array<{ id: string; parent_id: string | null }>),
      item.folderId
    ).slice(0, 1000);
  }

  let query = supabase
    .from("media")
    .select(MEDIA_SELECT)
    .eq("status", "active")
    .order("captured_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  query =
    scope !== null
      ? query.in("media_folder_id", scope)
      : item.projectId
        ? query.eq("project_id", item.projectId)
        : query.eq("id", item.id);

  const { data, error } = await query;
  if (error) {
    console.warn("[media] siblings query failed:", error.message);
    return { items: [], error: humanize(error.message) };
  }
  return {
    items: ((data ?? []) as unknown as MediaRowWithEmbeds[]).map((r) => toMediaItem(r)),
    error: null,
  };
}

/** Folders linked to one project (project detail → Media tab). */
export async function getProjectFolders(
  projectId: string
): Promise<{ folders: FolderCardData[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { folders: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media_folders")
    .select(FOLDER_SELECT)
    .eq("project_id", projectId)
    .order("name");
  if (error) {
    console.warn("[media] project folders failed:", error.message);
    return { folders: [], error: humanize(error.message) };
  }
  const rows = (data ?? []) as unknown as FolderRowWithProject[];
  return {
    folders: await hydrateFolderCards(supabase, rows, false),
    error: null,
  };
}

/** Flat folder list for the register/edit form picker. */
export async function getFlatFolders(
  limit = 200
): Promise<{ folders: MediaFolder[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { folders: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("media_folders")
    .select(FOLDER_SELECT)
    .order("name")
    .limit(limit);
  if (error) {
    console.warn("[media] flat folders failed:", error.message);
    return { folders: [], error: humanize(error.message) };
  }
  const rows = (data ?? []) as unknown as FolderRowWithProject[];
  return {
    folders: rows.map((r) => ({
      ...toMediaFolder(r),
      path: [],
      mediaCount: 0,
      childCount: 0,
      covers: [],
    })),
    error: null,
  };
}
