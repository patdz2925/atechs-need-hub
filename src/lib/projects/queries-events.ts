/* ============================================================
   Projects module — public event queries.
   Derives event sections from project stages using the existing
   project lifecycle (no separate events table).
   Queries use the browser-safe Supabase client (publishable key only).
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  toProject,
  type Project,
  type ProjectRow,
  type ProjectStage,
} from "./types";

const PROJECT_SELECT = `
  id, title, description, stage, priority, project_type, location,
  department_id, start_date, end_date, progress, created_by,
  created_at, updated_at, completed_at, archived_at, media,
  project_members ( profile_id, role ),
  project_departments ( department_id, departments ( name ) )
`;

/** Humanize PostgREST error messages for display. */
function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "Database schema out of date — run supabase/projects-reconcile.sql in the Supabase SQL Editor, then retry.";
  }
  return message;
}

/** Filters projects to only those appropriate for public display.
 *  Checks project_type or department to determine public visibility. */
function isPublicProjectRow(row: ProjectRow): boolean {
  const isOfficial = row.project_type === "event" || row.project_type === "ceremony";
  const hasDepartment = !!row.department_id;
  return isOfficial || hasDepartment;
}

/** Gets projects whose stage maps to "current" (live status). */
export async function getPublicCurrentProjects(): Promise<{
  projects: Project[];
  error: string | null;
}> {
  const supa = getBrowserSupabase();
  if (!supa) return { projects: [], error: "Supabase isn't configured." };

  const { data, error } = await supa
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("stage", "live")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[projects-events] current query failed:", error.message);
    return { projects: [], error: humanize(error.message) };
  }

  const rows = (data ?? []) as unknown as ProjectRow[];
  const publicRows = rows.filter((r) => isPublicProjectRow(r));
  const allProjects = publicRows.map((r) => toProject(r));

  return { projects: allProjects, error: null };
}

/** Gets projects whose stage maps to "upcoming" (planned or upcoming stage). */
export async function getPublicUpcomingProjects(): Promise<{
  projects: Project[];
  error: string | null;
}> {
  const supa = getBrowserSupabase();
  if (!supa) return { projects: [], error: "Supabase isn't configured." };

  const { data, error } = await supa
    .from("projects")
    .select(PROJECT_SELECT)
    .in("stage", ["planned", "upcoming"])
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[projects-events] upcoming query failed:", error.message);
    return { projects: [], error: humanize(error.message) };
  }

  const rows = (data ?? []) as unknown as ProjectRow[];
  const publicRows = rows.filter((r) => isPublicProjectRow(r));
  const allProjects = publicRows.map((r) => toProject(r));

  return { projects: allProjects, error: null };
}

/** Gets projects for the "Past Work" section: accomplished/completed
 *  stages PLUS archived projects. Archiving auto-routes a project to
 *  past work — only a hard delete removes it. Covers both archive
 *  signals: stage = archived, or archived_at set. */
export async function getPublicCompletedProjects(): Promise<{
  projects: Project[];
  error: string | null;
}> {
  const supa = getBrowserSupabase();
  if (!supa) return { projects: [], error: "Supabase isn't configured." };

  const { data, error } = await supa
    .from("projects")
    .select(PROJECT_SELECT)
    .or("stage.in.(accomplished,archived),archived_at.not.is.null")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[projects-events] completed query failed:", error.message);
    return { projects: [], error: humanize(error.message) };
  }

  const rows = (data ?? []) as unknown as ProjectRow[];
  const publicRows = rows.filter((r) => isPublicProjectRow(r));
  const allProjects = publicRows.map((r) => toProject(r));

  return { projects: allProjects, error: null };
}

/** Gets all public projects categorized by their event section. */
export async function getPublicEventProjects() {
  const [currentRes, upcomingRes, completedRes] = await Promise.all([
    getPublicCurrentProjects(),
    getPublicUpcomingProjects(),
    getPublicCompletedProjects(),
  ]);

  return {
    current: currentRes.projects,
    upcoming: upcomingRes.projects,
    accomplished: completedRes.projects,
    currentError: currentRes.error,
    upcomingError: upcomingRes.error,
    accomplishedError: completedRes.error,
  };
}