/* ============================================================
   Projects module — server-side queries (App Router components).
   Uses the cookie-authenticated server client (publishable key
   only; RLS does the enforcement). Components call these — no
   Supabase queries are scattered through the UI.
   ============================================================ */

import { createServerSupabase } from "@/lib/supabase/server";
import { getTaskStats } from "@/lib/tasks/queries";
import {
  toProject,
  type Department,
  type DirectoryMember,
  type Project,
  type ProjectRow,
} from "./types";

const PROJECT_SELECT = `
  id, title, description, stage, priority, project_type, location,
  department_id, start_date, end_date, progress, created_by,
  created_at, updated_at, completed_at, archived_at, media,
  project_members ( profile_id, role ),
  project_departments ( department_id, departments ( name ) )
`;

/** PostgREST column/schema-cache failures mean the reconciliation
 *  migration hasn't landed on this project — say so instead of
 *  echoing the raw API message. */
export function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "Database schema out of date — run supabase/projects-reconcile.sql in the Supabase SQL Editor, then retry.";
  }
  return message;
}

async function departmentNameMap(): Promise<Record<string, string>> {
  const deps = await getDepartments();
  return Object.fromEntries(deps.map((d) => [d.id, d.name]));
}

/** All departments (authenticated read per departments_view policy). */
export async function getDepartments(): Promise<Department[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, description")
    .order("name");
  if (error || !data) {
    if (error) console.warn("[projects] departments query failed:", error.message);
    return [];
  }
  return data as Department[];
}

/** Controlled member directory via the SECURITY DEFINER RPC.
 *  Returns only (id, name, role, department_id, department_name). */
export async function getMemberDirectory(): Promise<DirectoryMember[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("member_directory");
  if (error || !data) {
    if (error) console.warn("[projects] member_directory() failed:", error.message);
    return [];
  }
  return data as DirectoryMember[];
}

/** Every project (RLS: projects_authenticated_read — archive included).
 *  Progress is hydrated from task completion (see deriveProgress). */
export async function getProjects(): Promise<{ projects: Project[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { projects: [], error: "Supabase isn't configured." };

  const [res, deptNames, stats] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).order("created_at", { ascending: false }),
    departmentNameMap(),
    getTaskStats(),
  ]);

  if (res.error) {
    console.warn("[projects] list query failed:", res.error.message);
    return { projects: [], error: humanize(res.error.message) };
  }
  const rows = (res.data ?? []) as unknown as ProjectRow[];
  return {
    projects: rows.map((r) => toProject(r, deptNames, stats.get(r.id) ?? null)),
    error: null,
  };
}

/** One project by id. `project: null` + `error: null` ⇒ not found. */
export async function getProject(
  id: string
): Promise<{ project: Project | null; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { project: null, error: "Supabase isn't configured." };

  const [res, deptNames, stats] = await Promise.all([
    supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("id", id)
      .maybeSingle(),
    departmentNameMap(),
    getTaskStats(),
  ]);

  if (res.error) {
    console.warn("[projects] detail query failed:", res.error.message);
    return { project: null, error: humanize(res.error.message) };
  }
  if (!res.data) return { project: null, error: null };
  return {
    project: toProject(
      res.data as unknown as ProjectRow,
      deptNames,
      stats.get(id) ?? null
    ),
    error: null,
  };
}
