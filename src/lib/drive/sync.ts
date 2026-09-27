/* ============================================================
   Drive sync orchestrator. SERVER ONLY.
   Manual full sync (v1 foundation): walks the configured root,
   upserts folders + files idempotently, marks vanished Drive
   files archived (restorable), and records stats on the source
   row. Incremental change-feed sync is the documented next step
   (a start token is already captured below).
   NEVER called from Client Components — only the sync route.
   ============================================================ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { drive_v3 } from "googleapis";
import { createDriveClient, type DriveCredentials } from "./client";
import { walkAndUpsertFolders } from "./folders";
import { listFiles, noteFile, upsertFile } from "./files";
import {
  SYNC_LIMITS,
  emptyStats,
  type SyncResult,
  type SyncStats,
} from "./types";

export interface SyncSource {
  id: string;
  name: string;
  drive_folder_id: string;
  api_key: string | null;
  service_account_json: string | null;
  enabled: boolean;
}

export async function runDriveSync(
  drive: drive_v3.Drive,
  supa: SupabaseClient,
  source: SyncSource,
  uploaderId: string
): Promise<SyncResult> {
  const stats = emptyStats();
  const now = new Date().toISOString();

  try {
    // Root metadata first (fatal when unreadable — bad id / no access).
    const rootMeta = await drive.files.get({
      fileId: source.drive_folder_id,
      fields: "id, name, mimeType",
      supportsAllDrives: false,
    });
    const rootName = String(rootMeta.data.name ?? source.name);

    // 1) Folders (BFS, parents before children).
    const walk = await walkAndUpsertFolders(drive, supa, source.drive_folder_id, rootName);
    stats.foldersSeen = walk.ids.size;
    stats.foldersAdded = walk.stats.foldersAdded;
    stats.foldersUpdated = walk.stats.foldersUpdated;
    const partialFolders = walk.ids.size >= SYNC_LIMITS.maxFolders;

    // Folder context (visibility/project/department) for file inheritance.
    const { data: folderRows } = await supa
      .from("media_folders")
      .select("id, visibility, project_id, department_id")
      .in(
        "id",
        [...walk.ids.values()].slice(0, 1000)
      );
    const folderCtx = new Map(
      ((folderRows ?? []) as unknown as Array<{
        id: string;
        visibility: string;
        project_id: string | null;
        department_id: string | null;
      }>).map((f) => [f.id, f])
    );

    // 2) Files per folder (existing rows preloaded per folder for diffing).
    const seen = new Set<string>();
    let fileBudget = SYNC_LIMITS.maxFiles;
    for (const [driveFolderId, rowId] of walk.ids) {
      if (fileBudget <= 0) break;
      let files: Awaited<ReturnType<typeof listFiles>>;
      try {
        files = await listFiles(drive, driveFolderId);
      } catch (e) {
        stats.errors.push(
          `Folder ${driveFolderId}: ${e instanceof Error ? e.message : "list failed"}`
        );
        continue;
      }
      const ctx = folderCtx.get(rowId);
      const existing = await loadExisting(supa, rowId);
      for (const file of files) {
        if (fileBudget <= 0) break;
        fileBudget -= 1;
        seen.add(file.id);
        try {
          const result = await upsertFile(
            supa,
            rowId,
            ctx?.visibility ?? "organization",
            ctx?.project_id ?? null,
            ctx?.department_id ?? null,
            file,
            existing.get(file.id),
            uploaderId
          );
          noteFile(stats, result);
        } catch (e) {
          stats.errors.push(e instanceof Error ? e.message : `File ${file.id}: failed`);
        }
      }
    }
    const partialFiles = fileBudget <= 0;

    // 3) Vanished files: seen-set diff, scoped to synced folders only
    //    (manually registered or other-source rows are never touched).
    const touched = [...walk.ids.values()];
    if (touched.length) {
      const { data: scoped } = await supa
        .from("media")
        .select("id, drive_file_id, status, archived_by_sync")
        .in("media_folder_id", touched.slice(0, 1000))
        .not("drive_file_id", "is", null);
      for (const r of (scoped ?? []) as unknown as Array<{
        id: string;
        drive_file_id: string;
        status: string;
        archived_by_sync: boolean;
      }>) {
        if (seen.has(r.drive_file_id)) continue;
        if (r.status === "archived") continue; // manual archives stay as they are
        const { error } = await supa
          .from("media")
          .update({ status: "archived", archived_by_sync: true, last_synced_at: now })
          .eq("id", r.id);
        if (error) stats.errors.push(`Archive ${r.drive_file_id}: ${error.message}`);
        else stats.archived += 1;
      }
      // Restores are counted in upsertFile ("restored"); manual
      // archives (archived_by_sync = false) are never touched.
    }

    // 4) Capture a changes-feed token for future incremental sync.
    let syncToken: string | null = null;
    try {
      const tokenRes = await drive.changes.getStartPageToken({ supportsAllDrives: false });
      syncToken = tokenRes.data.startPageToken ?? null;
    } catch {
      syncToken = null; // API-key callers lack changes access — full scan next time
    }

    const status = stats.errors.length
      ? "error"
      : partialFolders || partialFiles
        ? "partial"
        : "ok";

    await supa
      .from("media_sources")
      .update({
        last_synced_at: now,
        sync_token: syncToken,
        last_status: status,
        last_stats: {
          foldersSeen: stats.foldersSeen,
          foldersAdded: stats.foldersAdded,
          foldersUpdated: stats.foldersUpdated,
          filesSeen: stats.filesSeen,
          filesAdded: stats.filesAdded,
          filesUpdated: stats.filesUpdated,
          restored: stats.restored,
          archived: stats.archived,
        },
        last_error: stats.errors.slice(0, 5).join(" | ") || null,
      })
      .eq("id", source.id);

    return { status, stats, error: stats.errors[0] ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed.";
    await supa
      .from("media_sources")
      .update({ last_status: "error", last_error: message.slice(0, 500) })
      .eq("id", source.id);
    return { status: "error", stats, error: message };
  }
}

/** Build a Drive client from a source row's stored credentials. */
export function driveClientFor(source: SyncSource) {
  const creds: DriveCredentials = {
    apiKey: source.api_key,
    serviceAccountJson: source.service_account_json,
  };
  return createDriveClient(creds);
}

async function loadExisting(
  supa: SupabaseClient,
  folderRowId: string
): Promise<
  Map<string, { id: string; file_name: string | null; mime_type: string | null; file_size: number | null; drive_modified_at: string | null; media_folder_id: string | null; status: string | null; archived_by_sync: boolean | null }>
> {
  const { data } = await supa
    .from("media")
    .select("id, drive_file_id, file_name, mime_type, file_size, drive_modified_at, media_folder_id, status, archived_by_sync")
    .eq("media_folder_id", folderRowId)
    .not("drive_file_id", "is", null)
    .limit(2000);
  const map = new Map<string, { id: string; file_name: string | null; mime_type: string | null; file_size: number | null; drive_modified_at: string | null; media_folder_id: string | null; status: string | null; archived_by_sync: boolean | null }>();
  for (const r of (data ?? []) as unknown as Array<{
    id: string;
    drive_file_id: string;
    file_name: string | null;
    mime_type: string | null;
    file_size: number | null;
    drive_modified_at: string | null;
    media_folder_id: string | null;
    status: string | null;
    archived_by_sync: boolean | null;
  }>) {
    map.set(r.drive_file_id, {
      id: r.id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      file_size: r.file_size,
      drive_modified_at: r.drive_modified_at,
      media_folder_id: r.media_folder_id,
      status: r.status,
      archived_by_sync: r.archived_by_sync,
    });
  }
  return map;
}
