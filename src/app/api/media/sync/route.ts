/* ============================================================
   Media Bank sync API (SERVER ONLY — googleapis + credentials
   never leave the server).
   GET  → source list + last sync status (president only).
   POST → run a manual sync for one source (president only).
   The sync writes with the triggering president's own session —
   RLS president policies enforce it; no service-role key exists
   in this project by design.
   ============================================================ */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { driveClientFor, runDriveSync } from "@/lib/drive/sync";

export const maxDuration = 300;

async function requirePresident() {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Supabase isn't configured.", status: 503 as const };
  const user = await getSessionUser();
  if (!user) return { error: "Sign in required.", status: 401 as const };
  const profile = await getProfile(user);
  if (profile.role !== "president") {
    return { error: "Only the president can manage media sync.", status: 403 as const };
  }
  return { supabase, user, profile };
}

type SourceRow = {
  id: string;
  name: string;
  drive_folder_id: string;
  api_key: string | null;
  service_account_json: string | null;
  enabled: boolean;
  last_synced_at: string | null;
  last_status: string | null;
  last_stats: unknown;
  last_error: string | null;
  updated_at: string;
};

function stripSecrets(row: SourceRow) {
  return {
    id: row.id,
    name: row.name,
    drive_folder_id: row.drive_folder_id,
    hasApiKey: !!row.api_key?.trim(),
    hasServiceAccount: !!row.service_account_json?.trim(),
    enabled: row.enabled,
    last_synced_at: row.last_synced_at,
    last_status: row.last_status,
    last_stats: row.last_stats,
    last_error: row.last_error,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  const gate = await requirePresident();
  if ("error" in gate) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  const { data, error } = await gate.supabase
    .from("media_sources")
    .select(
      "id, name, drive_folder_id, api_key, service_account_json, enabled, last_synced_at, last_status, last_stats, last_error, updated_at"
    )
    .order("created_at");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as unknown as SourceRow[];
  return NextResponse.json({ ok: true, sources: rows.map(stripSecrets) });
}

export async function POST(request: Request) {
  const gate = await requirePresident();
  if ("error" in gate) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  let sourceId = "";
  try {
    const body = (await request.json()) as unknown;
    sourceId =
      typeof body === "object" && body !== null && "sourceId" in body
        ? String((body as { sourceId: unknown }).sourceId ?? "")
        : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  if (!sourceId) {
    return NextResponse.json({ ok: false, error: "sourceId is required." }, { status: 400 });
  }

  const { data, error } = await gate.supabase
    .from("media_sources")
    .select(
      "id, name, drive_folder_id, api_key, service_account_json, enabled, last_synced_at, last_status, last_stats, last_error, updated_at"
    )
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Sync source not found." },
      { status: error ? 500 : 404 }
    );
  }
  const source = data as unknown as SourceRow;
  if (!source.enabled) {
    return NextResponse.json({ ok: false, error: "This source is disabled." }, { status: 409 });
  }

  let drive: ReturnType<typeof driveClientFor>["drive"];
  try {
    ({ drive } = driveClientFor(source));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Drive connection required." },
      { status: 409 }
    );
  }

  const result = await runDriveSync(drive, gate.supabase, source, gate.user.id);
  return NextResponse.json({
    ok: result.status !== "error",
    status: result.status,
    stats: result.stats,
    error: result.error,
  });
}
