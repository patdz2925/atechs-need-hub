/* ============================================================
   Drive sync engine — shared shapes. SERVER ONLY (runs inside
   Route Handlers / server code with googleapis — never import
   from a Client Component; grep lib/drive in reviews).
   ============================================================ */

/** A Drive file/folder as the sync cares about it. */
export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  trashed?: boolean;
}

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export interface SyncStats {
  foldersSeen: number;
  foldersAdded: number;
  foldersUpdated: number;
  filesSeen: number;
  filesAdded: number;
  filesUpdated: number;
  restored: number;
  archived: number;
  errors: string[];
}

export type SyncStatus = "ok" | "partial" | "error";

export interface SyncResult {
  status: SyncStatus;
  stats: SyncStats;
  error: string | null;
}

/** Safety caps: a manual sync never walks the whole internet. */
export const SYNC_LIMITS = {
  maxFolders: 500,
  maxFiles: 20000,
  pageSize: 1000,
} as const;

export function emptyStats(): SyncStats {
  return {
    foldersSeen: 0,
    foldersAdded: 0,
    foldersUpdated: 0,
    filesSeen: 0,
    filesAdded: 0,
    filesUpdated: 0,
    restored: 0,
    archived: 0,
    errors: [],
  };
}
