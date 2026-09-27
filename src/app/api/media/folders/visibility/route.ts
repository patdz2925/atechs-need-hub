/* ============================================================
   Folder visibility management (SERVER ONLY).
   POST → set a folder's visibility, optionally cascading to
   every media row in its subtree. President only (UI gate +
   RLS president policies on both tables).
   Folders have no "hidden" state: `private` IS the hidden state
   (visible to president/VP only — RLS enforces it, not the UI).
   ============================================================ */

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { getSubtreeIds } from "@/lib/media/folders";
import { isMediaVisibility } from "@/lib/media/types";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase isn't configured." }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const profile = await getProfile(user);
  if (profile.role !== "president") {
    return NextResponse.json(
      { ok: false, error: "Only the president can change folder visibility." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be JSON." }, { status: 400 });
  }
  const { folderId, visibility, applyToContents } = (body ?? {}) as {
    folderId?: unknown;
    visibility?: unknown;
    applyToContents?: unknown;
  };
  if (typeof folderId !== "string" || !folderId) {
    return NextResponse.json({ ok: false, error: "folderId is required." }, { status: 400 });
  }
  if (!isMediaVisibility(visibility)) {
    return NextResponse.json(
      { ok: false, error: "visibility must be private, organization, or school." },
      { status: 400 }
    );
  }

  // The folder itself (RLS president policy: always visible here).
  const { data: folder, error: folderError } = await supabase
    .from("media_folders")
    .select("id")
    .eq("id", folderId)
    .maybeSingle();
  if (folderError || !folder) {
    return NextResponse.json(
      { ok: false, error: folderError?.message ?? "Folder not found." },
      { status: folderError ? 500 : 404 }
    );
  }

  const { error: updateError } = await supabase
    .from("media_folders")
    .update({ visibility })
    .eq("id", folderId);
  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  let updatedMedia = 0;
  let updatedFolders = 0;
  if (applyToContents === true) {
    const { data: tree } = await supabase
      .from("media_folders")
      .select("id, parent_id")
      .limit(1000);
    const ids = getSubtreeIds(
      ((tree ?? []) as unknown as Array<{ id: string; parent_id: string | null }>),
      folderId
    ).slice(0, 1000);
    // Descendant folders follow the parent (the folder itself was
    // already updated above) so the whole tree reads consistently.
    const descendants = ids.filter((id) => id !== folderId);
    if (descendants.length) {
      const { error: folderError } = await supabase
        .from("media_folders")
        .update({ visibility })
        .in("id", descendants);
      if (folderError) {
        return NextResponse.json(
          { ok: false, error: `Folder saved, but subfolders failed: ${folderError.message}` },
          { status: 500 }
        );
      }
      updatedFolders = descendants.length;
    }
    const { error: mediaError, count } = await supabase
      .from("media")
      .update({ visibility }, { count: "exact" })
      .in("media_folder_id", ids);
    if (mediaError) {
      return NextResponse.json(
        { ok: false, error: `Folder saved, but contents failed: ${mediaError.message}` },
        { status: 500 }
      );
    }
    updatedMedia = count ?? 0;
  }

  return NextResponse.json({ ok: true, folderId, visibility, updatedMedia, updatedFolders });
}
