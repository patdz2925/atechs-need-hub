/* ============================================================
   Drive file indexing. SERVER ONLY.
   Lists non-folder files per folder, classifies them, and
   upserts media rows by drive_file_id (idempotent reruns).
   HUB-OWNED columns (title, description, tags, visibility,
   featured, project, department) are NEVER overwritten — only
   Drive-native columns move. Renames update file_name; the Hub
   title stays as the reporter wrote it.
   ============================================================ */

import type { drive_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DRIVE_FOLDER_MIME, SYNC_LIMITS, type DriveEntry, type SyncStats } from "./types";
import type { MediaType } from "@/lib/media/types";

const FILE_FIELDS =
  "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, trashed)";

export function classifyMediaType(mime: string): MediaType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (
    mime.startsWith("application/pdf") ||
    mime.includes("document") ||
    mime.includes("presentation") ||
    mime.includes("spreadsheet") ||
    mime.startsWith("text/")
  ) {
    return "document";
  }
  return "other";
}

export async function listFiles(
  drive: drive_v3.Drive,
  parentDriveId: string
): Promise<DriveEntry[]> {
  const out: DriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentDriveId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: FILE_FIELDS,
      pageSize: SYNC_LIMITS.pageSize,
      pageToken,
      supportsAllDrives: false,
    });
    for (const f of res.data.files ?? []) {
      if (String(f.mimeType) === DRIVE_FOLDER_MIME) continue;
      out.push({
        id: String(f.id),
        name: String(f.name ?? "Untitled file"),
        mimeType: String(f.mimeType ?? ""),
        size: f.size ?? undefined,
        createdTime: f.createdTime ?? undefined,
        modifiedTime: f.modifiedTime ?? undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

interface ExistingRow {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  drive_modified_at: string | null;
  media_folder_id: string | null;
  status: string | null;
  archived_by_sync: boolean | null;
}

/** Upsert one Drive file. Returns "added" | "updated" | "restored" | "unchanged". */
export async function upsertFile(
  supa: SupabaseClient,
  folderRowId: string,
  folderVisibility: string,
  folderProjectId: string | null,
  folderDepartmentId: string | null,
  file: DriveEntry,
  existing: ExistingRow | undefined,
  uploaderId: string
): Promise<"added" | "updated" | "restored" | "unchanged"> {
  const now = new Date().toISOString();
  const size = file.size !== undefined ? Number(file.size) : null;

  if (!existing) {
    const { error } = await supa.from("media").insert({
      drive_file_id: file.id,
      media_folder_id: folderRowId,
      title: file.name,
      file_name: file.name,
      mime_type: file.mimeType || null,
      file_size: Number.isFinite(size) ? size : null,
      media_type: classifyMediaType(file.mimeType),
      drive_created_at: file.createdTime ?? null,
      drive_modified_at: file.modifiedTime ?? null,
      project_id: folderProjectId,
      department_id: folderDepartmentId,
      visibility: folderVisibility,
      uploaded_by: uploaderId,
      last_synced_at: now,
    });
    if (error) throw new Error(`File "${file.name}": ${error.message}`);
    return "added";
  }

  // Drive-owned columns move; Hub-owned columns (title, description,
  // tags, visibility, featured, project) are left exactly as they are.
  // A reappearing file heals a sync-archival (manual archives, which
  // carry archived_by_sync = false, are never touched).
  const willRestore = existing.status === "archived" && existing.archived_by_sync === true;
  const changed =
    (existing.file_name ?? null) !== file.name ||
    (existing.mime_type ?? null) !== (file.mimeType || null) ||
    (existing.file_size ?? null) !== (Number.isFinite(size) ? size : null) ||
    (existing.drive_modified_at ?? null) !== (file.modifiedTime ?? null) ||
    (existing.media_folder_id ?? null) !== folderRowId;

  const { error } = await supa
    .from("media")
    .update({
      file_name: file.name,
      mime_type: file.mimeType || null,
      file_size: Number.isFinite(size) ? size : null,
      drive_modified_at: file.modifiedTime ?? null,
      media_folder_id: folderRowId,
      last_synced_at: now,
      ...(willRestore ? { status: "active", archived_by_sync: false } : {}),
    })
    .eq("id", existing.id);
  if (error) throw new Error(`File "${file.name}": ${error.message}`);
  if (willRestore) return "restored";
  return changed ? "updated" : "unchanged";
}

export function noteFile(
  stats: Pick<SyncStats, "filesSeen" | "filesAdded" | "filesUpdated" | "restored">,
  result: "added" | "updated" | "restored" | "unchanged"
): void {
  stats.filesSeen += 1;
  if (result === "added") stats.filesAdded += 1;
  else if (result === "updated") stats.filesUpdated += 1;
  else if (result === "restored") stats.restored += 1;
}
