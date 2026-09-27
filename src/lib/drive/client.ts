/* ============================================================
   Drive API client factory. SERVER ONLY — credentials (API key /
   service-account JSON) live in media_sources (president-only
   RLS) and are read server-side by the sync/thumbnail routes.
   NEVER import from a Client Component.
   ============================================================ */

import { google, type drive_v3 } from "googleapis";

export interface DriveCredentials {
  apiKey?: string | null;
  serviceAccountJson?: string | null;
}

export type DriveMode = "api-key" | "service-account";

/** Which credential a source row offers (service account wins —
 *  it can read private trees shared with it). */
export function driveMode(creds: DriveCredentials): DriveMode | null {
  if (creds.serviceAccountJson?.trim()) return "service-account";
  if (creds.apiKey?.trim()) return "api-key";
  return null;
}

/** Official Drive v3 client. Least privilege: readonly scope for
 *  service accounts (sync + thumbnails never write to Drive). */
export function createDriveClient(creds: DriveCredentials): {
  drive: drive_v3.Drive;
  mode: DriveMode;
} {
  const mode = driveMode(creds);
  if (!mode) {
    throw new Error(
      "Google Drive connection required — configure an API key or service account on this media source first."
    );
  }

  if (mode === "api-key") {
    const drive = google.drive({ version: "v3", auth: creds.apiKey!.trim() });
    return { drive, mode };
  }

  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(creds.serviceAccountJson!.trim());
  } catch {
    throw new Error("The stored service-account key is not valid JSON — replace it on the media source.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("The service-account key is missing client_email / private_key.");
  }
  const auth = new google.auth.JWT({
    email: parsed.client_email,
    key: parsed.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });
  return { drive, mode };
}
