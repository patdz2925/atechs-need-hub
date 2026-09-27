/* ============================================================
   Dashboard events module — browser-safe queries.
   Uses the browser-side Supabase client (publishable key only).
   Never imports server.ts (which uses next/headers).
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";

/** Every event the viewer's RLS allows — source for dashboard. */
export async function getCurrentEvents(): Promise<{ events: any[]; error: string | null }> {
  const supa = getBrowserSupabase();
  if (!supa) return { events: [], error: "Supabase isn't configured." };

  const { data, error } = await supa.from("projects")
    .select("id, title, description, stage, progress, department_id, start_date, end_date")
    .eq("stage", "live")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[events] current query failed:", error.message);
    return { events: [], error: error.message };
  }
  return { events: data as any[], error: null };
}

export async function getUpcomingEvents(): Promise<{ events: any[]; error: string | null }> {
  const supa = getBrowserSupabase();
  if (!supa) return { events: [], error: "Supabase isn't configured." };

  const { data, error } = await supa.from("projects")
    .select("id, title, description, stage, progress, department_id, start_date, end_date")
    .in("stage", ["planned", "upcoming"])
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[events] upcoming query failed:", error.message);
    return { events: [], error: error.message };
  }
  return { events: data as any[], error: null };
}

export async function getAccomplishedEvents(): Promise<{ events: any[]; error: string | null }> {
  const supa = getBrowserSupabase();
  if (!supa) return { events: [], error: "Supabase isn't configured." };

  const { data, error } = await supa.from("projects")
    .select("id, title, description, stage, progress, department_id, start_date, end_date")
    .eq("stage", "accomplished")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[events] accomplished query failed:", error.message);
    return { events: [], error: error.message };
  }
  return { events: data as any[], error: null };
}