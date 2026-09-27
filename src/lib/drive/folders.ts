/* ============================================================
   Drive folder walk. SERVER ONLY.
   Breadth-first from the configured root: every folder is
   upserted by drive_folder_id (idempotent), parents resolve
   because BFS processes a folder before its children.
   ============================================================ */

import type { drive_v3 } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DRIVE_FOLDER_MIME, SYNC_LIMITS, type DriveEntry, type SyncStats } from "./types";

const FOLDER_FIELDS = "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, trashed)";

async function listChildren(
  drive: drive_v3.Drive,
  parentDriveId: string
): Promise<DriveEntry[]> {
  const out: DriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentDriveId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields: FOLDER_FIELDS,
      pageSize: SYNC_LIMITS.pageSize,
      pageToken,
      supportsAllDrives: false,
    });
    for (const f of res.data.files ?? []) {
      out.push({
        id: String(f.id),
        name: String(f.name ?? "Untitled folder"),
        mimeType: String(f.mimeType ?? ""),
        createdTime: f.createdTime ?? undefined,
        modifiedTime: f.modifiedTime ?? undefined,
        trashed: f.trashed ?? undefined,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export interface FolderWalk {
  /** drive_folder_id → row uuid (includes the root). */
  ids: Map<string, string>;
  stats: Pick<SyncStats, "foldersSeen" | "foldersAdded" | "foldersUpdated">;
}

/** Walk + upsert the whole tree. New folders default to
 *  organization visibility; project mapping is a deliberate
 *  presidential action in the explorer (never auto-guessed).
 *  Throws only on fatal errors (root unreadable); per-folder
 *  failures are collected by callers. */
export async function walkAndUpsertFolders(
  drive: drive_v3.Drive,
  supa: SupabaseClient,
  rootDriveFolderId: string,
  rootName: string
): Promise<FolderWalk> {
  const ids = new Map<string, string>();
  const stats = { foldersSeen: 0, foldersAdded: 0, foldersUpdated: 0 };

  // Root row first (parent null) so every child resolves.
  const rootRow = await upsertFolder(supa, {
    drive_folder_id: rootDriveFolderId,
    parent_id: null,
    name: rootName,
    stats,
  });
  if (!rootRow) throw new Error("The root Drive folder could not be indexed.");
  ids.set(rootDriveFolderId, rootRow);

  const queue: Array<{ driveId: string; rowId: string }> = [
    { driveId: rootDriveFolderId, rowId: rootRow },
  ];
  while (queue.length) {
    if (ids.size > SYNC_LIMITS.maxFolders) break;
    const current = queue.shift()!;
    const children = await listChildren(drive, current.driveId);
    for (const child of children) {
      if (child.mimeType !== DRIVE_FOLDER_MIME) continue;
      if (ids.has(child.id)) continue;
      stats.foldersSeen += 1;
      const rowId = await upsertFolder(supa, {
        drive_folder_id: child.id,
        parent_id: current.rowId,
        name: child.name,
        stats,
      });
      if (rowId) {
        ids.set(child.id, rowId);
        queue.push({ driveId: child.id, rowId });
      }
    }
  }

  return { ids, stats };
}

async function upsertFolder(
  supa: SupabaseClient,
  args: {
    drive_folder_id: string;
    parent_id: string | null;
    name: string;
    stats: Pick<SyncStats, "foldersAdded" | "foldersUpdated">;
  }
): Promise<string | null> {
  const { data: existing } = await supa
    .from("media_folders")
    .select("id")
    .eq("drive_folder_id", args.drive_folder_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supa
      .from("media_folders")
      .update({ name: args.name, parent_id: args.parent_id, last_synced_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(`Folder "${args.name}": ${error.message}`);
    args.stats.foldersUpdated += 1;
    return (existing as { id: string }).id;
  }

  const { data, error } = await supa
    .from("media_folders")
    .insert({
      drive_folder_id: args.drive_folder_id,
      parent_id: args.parent_id,
      name: args.name,
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Folder "${args.name}": ${error?.message ?? "insert failed"}`);
  args.stats.foldersAdded += 1;
  return (data as { id: string }).id;
}
