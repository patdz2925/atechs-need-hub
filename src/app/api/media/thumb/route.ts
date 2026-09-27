/* ============================================================
   Authenticated thumbnail proxy (SERVER ONLY).
   Private Drive files must never get permanent public thumbnail
   URLs — so the grid/lightbox load previews THROUGH here:
     1. session required (any signed-in user),
     2. the media row is fetched with the caller's own session
        (RLS decides — invisible rows 404 exactly like missing),
     3. bytes are fetched server-side with the configured Drive
        credentials and streamed back with a short private cache.
   No full-file video proxying (too heavy) — videos keep their
   Drive links + safe-embed fallback.
   ============================================================ */

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { driveMode } from "@/lib/drive/client";

function fail(status: number) {
  return new NextResponse(null, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  const width = Math.min(1920, Math.max(64, Number(searchParams.get("w")) || 800));
  if (!id) return fail(400);

  const supabase = await createServerSupabase();
  if (!supabase) return fail(503);
  const user = await getSessionUser();
  if (!user) return fail(401);

  // RLS-scoped: invisible rows behave as missing.
  const { data, error } = await supabase
    .from("media")
    .select("id, drive_file_id, thumbnail_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return fail(404);
  const row = data as unknown as {
    drive_file_id: string | null;
    thumbnail_url: string | null;
  };

  // Curated thumbnails are public-safe by uploader choice — redirect.
  if (row.thumbnail_url) {
    return NextResponse.redirect(row.thumbnail_url, { status: 302 });
  }
  if (!row.drive_file_id) return fail(404);

  // Resolve Drive credentials: first enabled source wins (service
  // account preferred — it reads private trees shared with it).
  const { data: sources } = await supabase
    .from("media_sources")
    .select("api_key, service_account_json, enabled");
  const creds = ((sources ?? []) as unknown as Array<{
    api_key: string | null;
    service_account_json: string | null;
    enabled: boolean;
  }>).filter((s) => s.enabled);
  if (!creds.length) return fail(404);

  for (const c of creds) {
    try {
      const mode = driveMode({ apiKey: c.api_key, serviceAccountJson: c.service_account_json });
      if (mode === "service-account") {
        // Authenticated path — works for private trees shared with
        // the service account. thumbnailLink itself is fetched with
        // Drive auth, then its bytes are streamed with a token.
        const sa = JSON.parse((c.service_account_json ?? "").trim()) as {
          client_email?: string;
          private_key?: string;
        };
        if (!sa.client_email || !sa.private_key) continue;
        const auth = new google.auth.JWT({
          email: sa.client_email,
          key: sa.private_key,
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });
        const drive = google.drive({ version: "v3", auth });
        const meta = await drive.files.get({
          fileId: row.drive_file_id,
          fields: "thumbnailLink",
          supportsAllDrives: false,
        });
        const link = meta.data.thumbnailLink as string | undefined;
        if (!link) continue;
        const { token } = await auth.getAccessToken();
        if (!token) continue;
        const upstream = await fetch(link, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!upstream.ok || !upstream.body) continue;
        return new NextResponse(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "private, max-age=300",
          },
        });
      }
      // API-key mode: only publicly shared files resolve — redirect
      // to the thumbnail service (no bytes through our server).
      return NextResponse.redirect(
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(row.drive_file_id)}&sz=w${width}`,
        { status: 302 }
      );
    } catch {
      continue;
    }
  }
  return fail(404);
}
