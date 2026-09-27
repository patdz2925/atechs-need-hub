/* ============================================================
   Media Bank module — domain types, Drive reference helpers,
   filter shapes & permission gates.
   Schema: supabase/media-bank.sql
     media (
       id uuid PK, title text, description text?,
       media_type = image | video | document | other,
       mime_type?, file_name?, file_size?,
       drive_file_id?, drive_url?, drive_folder_id?,
       thumbnail_url?, preview_url?,
       project_id? → projects (cascade),
       department_id? → departments (set null),
       uploaded_by → profiles (restrict),
       captured_at?, created_at, updated_at,
       visibility = private | organization | school (default org),
       status = active | archived (default active),
       tags text[], location?, event_name? (legacy),
       is_featured bool default false
     )
   Rows are an INDEX into Google Drive — never the binary. Hub
   organizes, Drive stores.
   ============================================================ */

import { can, type Role } from "@/lib/roles";

/* ---------- Enums (mirror the DB checks exactly) ---------- */

export type MediaType = "image" | "video" | "document" | "other";

export type MediaVisibility = "private" | "organization" | "school" | "public" | "department";

export type MediaStatus = "active" | "archived";

export const MEDIA_TYPES: MediaType[] = ["image", "video", "document", "other"];

export const MEDIA_VISIBILITIES: MediaVisibility[] = ["private", "organization", "school", "public", "department"];

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  image: "Photo",
  video: "Video",
  document: "Document",
  other: "Other",
};

export const MEDIA_VISIBILITY_LABEL: Record<MediaVisibility, string> = {
  private: "Private",
  organization: "Organization",
  school: "School",
  public: "Public",
  department: "Department",
};

export function isMediaType(v: unknown): v is MediaType {
  return typeof v === "string" && (MEDIA_TYPES as string[]).includes(v);
}

export function isMediaVisibility(v: unknown): v is MediaVisibility {
  return typeof v === "string" && (MEDIA_VISIBILITIES as string[]).includes(v);
}

/* ---------- Google Drive reference helpers (pure strings) ----------
   Drive is the storage layer; these only BUILD links from stored
   file/folder ids. No OAuth, no secrets, no fetching. */

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com"];

export function isDriveUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    return DRIVE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Accepts pasted Drive URLs (/file/d/ID, open?id=ID, ?id=ID) or a
 *  bare file id — returns the id or null. Never throws. */
export function parseDriveFileId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[\w-]{10,}$/.test(v) && !v.includes("/") && !v.includes(" ")) return v;
  try {
    const u = new URL(v);
    const m = u.pathname.match(/\/d\/([\w-]+)/);
    if (m) return m[1];
    const q = u.searchParams.get("id");
    if (q && /^[\w-]+$/.test(q)) return q;
  } catch {
    return null;
  }
  return null;
}

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/** Direct-download link (works for "anyone with the link" files). */
export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Drive thumbnail service (progressive enhancement — callers must
 *  fall back to a placeholder on error). */
export function driveThumbnailUrl(fileId: string, width = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

/** Best outbound link for a row: explicit URL wins, else derive from
 *  the stored file/folder ids. Null = nothing to open. */
export function driveOutboundUrl(item: {
  driveUrl: string | null;
  driveFileId: string | null;
  driveFolderId: string | null;
}): string | null {
  if (item.driveUrl && isDriveUrl(item.driveUrl)) return item.driveUrl;
  if (item.driveFileId) return driveFileUrl(item.driveFileId);
  if (item.driveFolderId) return driveFolderUrl(item.driveFolderId);
  if (item.driveUrl && item.driveUrl.startsWith("https://")) return item.driveUrl;
  return null;
}

/** Best grid thumbnail: stored thumbnail → Drive service → null
 *  (caller renders the type placeholder). */
export function gridThumbnail(item: {
  thumbnailUrl: string | null;
  driveFileId: string | null;
}): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.driveFileId) return driveThumbnailUrl(item.driveFileId);
  return null;
}

/* ---------- Row / view shapes ---------- */

export interface MediaRow {
  id: string;
  title: string;
  description: string | null;
  media_type: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  drive_file_id: string | null;
  drive_url: string | null;
  drive_folder_id: string | null;
  media_folder_id: string | null;
  drive_created_at: string | null;
  drive_modified_at: string | null;
  last_synced_at: string | null;
  thumbnail_url: string | null;
  preview_url: string | null;
  project_id: string | null;
  department_id: string | null;
  uploaded_by: string;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
  visibility: string | null;
  status: string | null;
  tags: string[] | null;
  location: string | null;
  event_name: string | null;
  is_featured: boolean | null;
}

/** View model the UI consumes. Uploader identity resolves via the
 *  member directory — emails never leave the server. */
export interface MediaItem {
  id: string;
  title: string;
  description: string;
  mediaType: MediaType;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  driveFileId: string | null;
  driveUrl: string | null;
  driveFolderId: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  projectId: string | null;
  projectTitle: string;
  /** Primary department of the linked project (DH scoping). */
  projectDeptId: string | null;
  /** Hub-side folder membership (Drive hierarchy link). */
  folderId: string | null;
  driveCreatedAt: string | null;
  driveModifiedAt: string | null;
  lastSyncedAt: string | null;
  departmentId: string | null;
  departmentName: string;
  uploadedBy: string;
  uploaderName: string;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
  visibility: MediaVisibility;
  status: MediaStatus;
  tags: string[];
  location: string | null;
  eventName: string | null;
  isFeatured: boolean;
}

interface MediaEmbeds {
  projects?: { id: string; title: string; department_id: string | null } | null;
  departments?: { id: string; name: string } | null;
}

export function toMediaItem(
  row: MediaRow & MediaEmbeds,
  uploaderName = ""
): MediaItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    mediaType: isMediaType(row.media_type) ? row.media_type : "other",
    mimeType: row.mime_type,
    fileName: row.file_name,
    fileSize: row.file_size,
    driveFileId: row.drive_file_id,
    driveUrl: row.drive_url,
    driveFolderId: row.drive_folder_id,
    folderId: row.media_folder_id,
    driveCreatedAt: row.drive_created_at,
    driveModifiedAt: row.drive_modified_at,
    lastSyncedAt: row.last_synced_at,
    thumbnailUrl: row.thumbnail_url,
    previewUrl: row.preview_url,
    projectId: row.project_id,
    projectTitle: row.projects?.title ?? "",
    projectDeptId: row.projects?.department_id ?? null,
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? "",
    uploadedBy: row.uploaded_by,
    uploaderName,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    visibility: isMediaVisibility(row.visibility) ? row.visibility : "organization",
    status: row.status === "archived" ? "archived" : "active",
    tags: row.tags ?? [],
    location: row.location,
    eventName: row.event_name,
    isFeatured: row.is_featured ?? false,
  };
}

/** Lowercase + trim + dedupe (mirrors the DB trigger). */
export function normalizeTags(input: string): string[] {
  const seen = new Set<string>();
  for (const part of input.split(",")) {
    const t = part.trim().toLowerCase();
    if (t && !seen.has(t)) seen.add(t);
  }
  return [...seen];
}

/* ---------- Folders (Drive hierarchy) ---------- */

export interface MediaFolderRow {
  id: string;
  drive_folder_id: string;
  parent_id: string | null;
  name: string;
  project_id: string | null;
  department_id: string | null;
  visibility: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

export interface MediaFolder {
  id: string;
  driveFolderId: string;
  parentId: string | null;
  name: string;
  projectId: string | null;
  projectTitle: string;
  departmentId: string | null;
  visibility: MediaVisibility;
  updatedAt: string;
  lastSyncedAt: string | null;
  /** Breadcrumb chain root → this folder (names only). */
  path: Array<{ id: string; name: string }>;
  mediaCount: number;
  childCount: number;
  /** Up to 4 cover thumbnails (rendered as a collage). */
  covers: string[];
}

export function toMediaFolder(
  row: MediaFolderRow & {
    projects?: { id: string; title: string } | null;
  }
): Omit<MediaFolder, "path" | "mediaCount" | "childCount" | "covers"> {
  return {
    id: row.id,
    driveFolderId: row.drive_folder_id,
    parentId: row.parent_id,
    name: row.name,
    projectId: row.project_id,
    projectTitle: row.projects?.title ?? "",
    departmentId: row.department_id,
    visibility: isMediaVisibility(row.visibility) ? row.visibility : "organization",
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
  };
}

/* ---------- Filter / sort shapes (server-paginated) ---------- */

export type MediaSortKey = "newest" | "oldest" | "recently_added" | "title";

export const MEDIA_SORT_LABEL: Record<MediaSortKey, string> = {
  newest: "Newest captured",
  oldest: "Oldest captured",
  recently_added: "Recently added",
  title: "Title A–Z",
};

export interface MediaFilters {
  query: string;
  type: "all" | MediaType;
  projectId: "all" | string;
  departmentId: "all" | string;
  /** Hub-side folder scope (null = whole archive). */
  folderId: "all" | string;
  tag: string;
  dateFrom: string; // "" allowed (YYYY-MM-DD on captured_at)
  dateTo: string; // "" allowed
  featured: boolean;
  /** Active browsing hides archived rows; archivists opt in. */
  status: "active" | "archived" | "all";
  sort: MediaSortKey;
}

export const DEFAULT_MEDIA_FILTERS: MediaFilters = {
  query: "",
  type: "all",
  projectId: "all",
  departmentId: "all",
  folderId: "all",
  tag: "",
  dateFrom: "",
  dateTo: "",
  featured: false,
  status: "active",
  sort: "recently_added",
};

export const MEDIA_PAGE_SIZE = 24;

/** Slim dashboard tile (mapped in the dashboard service layer). */
export interface MediaTile {
  id: string;
  title: string;
  type: MediaType;
  project: string;
  date: string;
  /** Grid thumbnail URL (Drive/stored) — null falls back to gradient. */
  thumb: string | null;
}

/** Gradient fallback per type (same family as the old demo tiles). */
export function tileGradient(type: MediaType): string {
  switch (type) {
    case "image":
      return "linear-gradient(135deg, #0040bb, #3b82f6)";
    case "video":
      return "linear-gradient(135deg, #18181b, #0040bb)";
    case "document":
      return "linear-gradient(135deg, #27272a, #3f3f46)";
    case "other":
      return "linear-gradient(135deg, #0e1116, #0040bb)";
  }
}

/* ---------- Permissions (thin wrappers over PERMISSIONS) ---------- */

export interface MediaActions {
  /** Register media (president, VP, officer, department head). */
  create: boolean;
  /** Feature/unfeature (president + VP — trigger-enforced too). */
  feature: boolean;
  /** Delete any record (president). */
  manageAll: boolean;
}

export function mediaActions(role: Role): MediaActions {
  return {
    create:
      role === "president" ||
      role === "vice_president" ||
      role === "officer" ||
      role === "department_head",
    feature: role === "president" || role === "vice_president",
    manageAll: can(role, "manage"),
  };
}

/** Edit metadata / archive / restore this row? Owner on active rows,
 *  president/VP anywhere, department heads inside their department. */
export function canEditMedia(
  role: Role,
  viewerId: string,
  viewerDeptId: string | null,
  item: Pick<MediaItem, "uploadedBy" | "status" | "departmentId" | "projectDeptId">
): boolean {
  if (role === "president" || role === "vice_president") return true;
  if (item.uploadedBy === viewerId && item.status === "active") return true;
  if (role === "department_head" && viewerDeptId) {
    return item.departmentId === viewerDeptId || item.projectDeptId === viewerDeptId;
  }
  return false;
}

/** Delete ("Remove from Media Bank")? President only. */
export function canDeleteMedia(role: Role): boolean {
  return role === "president";
}
