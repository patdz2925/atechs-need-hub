/* ============================================================
   Media Bank module — client-side mutations (browser Supabase
   client, cookie session). Every write is enforced by RLS +
   DB CHECKs/triggers — these calls only carry the payload.
   UI gating mirrors src/lib/media/types.ts mediaActions():
     register → president, VP, officer, department head
     edit/archive/restore → owner, president, VP, DH in-scope
     feature → president + VP (trigger-enforced too)
     delete ("Remove from Media Bank") → president (Drive
       original is never touched)
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  isDriveUrl,
  normalizeTags,
  parseDriveFileId,
  type MediaType,
  type MediaVisibility,
} from "./types";

export interface MediaFormValues {
  title: string;
  description: string;
  mediaType: MediaType;
  /** Raw Drive input: full URL or bare file id (validated below). */
  driveInput: string;
  driveFolderId: string;
  thumbnailUrl: string;
  previewUrl: string;
  projectId: string | null;
  departmentId: string | null;
  /** Hub-side folder (explorer hierarchy). */
  folderId: string | null;
  capturedAt: string; // "" allowed
  location: string;
  eventName: string;
  tags: string[];
  visibility: MediaVisibility;
  isFeatured: boolean;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export type MediaContext = "create" | "edit" | "archive" | "feature" | "delete" | "sync" | "folder";

/** Friendly mapping for READ failures (grid pagination/filtering),
 *  where no write context applies. */
export function friendlyReadError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/media-bank.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) return "You don't have permission to view this media.";
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

function friendly(context: MediaContext, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/media-bank.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) {
    if (context === "create") return "Only presidents, VPs, officers and department heads can register media.";
    if (context === "feature") return "Only the president or vice president can feature media.";
    if (context === "delete") return "Only the president can remove media records.";
    return "You don't have permission to change this media.";
  }
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  // DB CHECK / trigger messages are already human-readable.
  return message;
}

/* ---------- Sync sources + folder mapping (president) ---------- */

export interface MediaSourceInput {
  name: string;
  driveFolderId: string;
  apiKey: string;
  serviceAccountJson: string;
}

function friendlySource(action: string, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/media-sync.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) return "Only the president can manage sync sources.";
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return `${action} failed: ${message}`;
}

/** Add a sync source (root Drive folder + credentials). */
export async function createMediaSource(input: MediaSourceInput): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  if (!input.name.trim() || !input.driveFolderId.trim()) {
    return { ok: false, error: "A source needs a name and a root Drive folder ID." };
  }
  const { data, error } = await client.supabase
    .from("media_sources")
    .insert({
      name: input.name.trim(),
      drive_folder_id: input.driveFolderId.trim(),
      api_key: input.apiKey.trim() || null,
      service_account_json: input.serviceAccountJson.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: friendlySource("Saving the source", error?.message ?? "unknown error") };
  }
  return { ok: true, id: String((data as { id: string }).id) };
}

/** Enable / disable a source (disabled sources never sync). */
export async function setMediaSourceEnabled(id: string, enabled: boolean): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const { error } = await client.supabase.from("media_sources").update({ enabled }).eq("id", id);
  if (error) return { ok: false, error: friendlySource("Updating the source", error.message) };
  return { ok: true };
}

/** Remove a source configuration (indexed rows stay untouched). */
export async function deleteMediaSource(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const { error } = await client.supabase.from("media_sources").delete().eq("id", id);
  if (error) return { ok: false, error: friendlySource("Removing the source", error.message) };
  return { ok: true };
}

/** Map a folder to a project (or unmap with null). President only. */
export async function setFolderProject(
  folderId: string,
  projectId: string | null
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const { error } = await client.supabase
    .from("media_folders")
    .update({ project_id: projectId })
    .eq("id", folderId);
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("row-level security")) {
      return { ok: false, error: "Only the president can map folders to projects." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

function assertClient() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: "Supabase isn't configured. Add credentials to .env.local." };
  return { supabase };
}

/** Split the Drive input into stored columns. Returns an error
 *  string when the input is unusable (caller surfaces it without
 *  touching the network). */
function resolveDriveInput(
  driveInput: string,
  driveFolderId: string
): { fileId: string | null; url: string | null; folderId: string | null; error?: string } {
  const raw = driveInput.trim();
  const folder = driveFolderId.trim() || null;

  if (!raw) {
    if (folder) return { fileId: null, url: null, folderId: folder };
    return { fileId: null, url: null, folderId: null, error: "A Drive file or folder reference is required." };
  }
  if (raw.startsWith("https://")) {
    if (!isDriveUrl(raw)) {
      return { fileId: null, url: null, folderId: folder, error: "Only Google Drive links are accepted — paste a drive.google.com URL." };
    }
    return { fileId: parseDriveFileId(raw), url: raw, folderId: folder };
  }
  const bare = parseDriveFileId(raw);
  if (!bare) {
    return { fileId: null, url: null, folderId: folder, error: "That doesn't look like a Drive link or file ID." };
  }
  return { fileId: bare, url: null, folderId: folder };
}

function payload(values: MediaFormValues): Record<string, unknown> {
  const drive = resolveDriveInput(values.driveInput, values.driveFolderId);
  if (drive.error) throw new Error(drive.error);
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    media_type: values.mediaType,
    drive_file_id: drive.fileId,
    drive_url: drive.url,
    drive_folder_id: drive.folderId,
    thumbnail_url: values.thumbnailUrl.trim() || null,
    preview_url: values.previewUrl.trim() || null,
    project_id: values.projectId,
    department_id: values.departmentId,
    media_folder_id: values.folderId,
    captured_at: values.capturedAt ? new Date(`${values.capturedAt}T00:00:00Z`).toISOString() : null,
    location: values.location.trim() || null,
    event_name: values.eventName.trim() || null,
    tags: normalizeTags(values.tags.join(",")),
    visibility: values.visibility,
    is_featured: values.isFeatured,
  };
}

/** Register a Drive file/folder in the Bank (contributors). */
export async function createMedia(
  values: MediaFormValues,
  uploaderId: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  let body: Record<string, unknown>;
  try {
    body = payload(values);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid Drive reference." };
  }

  const { data, error } = await client.supabase
    .from("media")
    .insert({ ...body, uploaded_by: uploaderId })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: friendly("create", error?.message ?? "Could not register the media.") };
  }
  return { ok: true, id: String(data.id) };
}

/** Edit metadata (owner / president / VP / in-scope DH). */
export async function updateMedia(id: string, values: MediaFormValues): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  let body: Record<string, unknown>;
  try {
    body = payload(values);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid Drive reference." };
  }

  const { error } = await client.supabase.from("media").update(body).eq("id", id);
  if (error) return { ok: false, error: friendly("edit", error.message) };
  return { ok: true };
}

/** Archive (hide) or restore a record. Drive original untouched. */
export async function setMediaArchived(id: string, archived: boolean): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("media")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", id);
  if (error) return { ok: false, error: friendly("archive", error.message) };
  return { ok: true };
}

/** Feature / unfeature (president + VP; trigger-enforced too). */
export async function setMediaFeatured(id: string, featured: boolean): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("media")
    .update({ is_featured: featured })
    .eq("id", id);
  if (error) return { ok: false, error: friendly("feature", error.message) };
  return { ok: true };
}

/** Remove the index row (president). The Drive original is untouched. */
export async function deleteMedia(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase.from("media").delete().eq("id", id);
  if (error) return { ok: false, error: friendly("delete", error.message) };
  return { ok: true };
}
