/* ============================================================
   Tasks module — server-side queries (App Router components).
   Cookie-authenticated server client, publishable key only.
   RLS decides visibility; these never bypass it.
   ============================================================ */

import { createServerSupabase } from "@/lib/supabase/server";
import {
  isTaskStatus,
  tallyTask,
  toTask,
  type Task,
  type TaskRow,
  type TaskStats,
} from "./types";

/** Project title rides along via the FK embed so task rows can render a
 *  project link without a second fetch. */
const TASK_SELECT = `
  id, title, description, project_id, assignee_id, status, priority,
  due_date, created_at, created_by,
  projects ( id, title )
`;

interface TaskRowWithProject extends TaskRow {
  projects: { id: string; title: string } | null;
}

function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "Database schema out of date — run supabase/tasks-inspect.sql to confirm the tasks tables, then retry.";
  }
  if (m.includes("row-level security")) return "You don't have permission to view these tasks.";
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

function hydrate(row: TaskRowWithProject): Task {
  return toTask(row, row.projects?.title ?? "");
}

/** Every task the viewer's RLS allows — the source for both the My Tasks
 *  page and per-project tabs (org-sized data, filtered client-side). */
export async function getTasks(): Promise<{ tasks: Task[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { tasks: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[tasks] list query failed:", error.message);
    return { tasks: [], error: humanize(error.message) };
  }
  return { tasks: ((data ?? []) as unknown as TaskRowWithProject[]).map(hydrate), error: null };
}

/** Tasks belonging to one project (project workspace → Tasks tab). */
export async function getProjectTasks(
  projectId: string
): Promise<{ tasks: Task[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { tasks: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[tasks] project query failed:", error.message);
    return { tasks: [], error: humanize(error.message) };
  }
  return { tasks: ((data ?? []) as unknown as TaskRowWithProject[]).map(hydrate), error: null };
}

/** One task. `task: null` + `error: null` ⇒ not found. */
export async function getTask(
  id: string
): Promise<{ task: Task | null; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { task: null, error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[tasks] detail query failed:", error.message);
    return { task: null, error: humanize(error.message) };
  }
  if (!data) return { task: null, error: null };
  return { task: hydrate(data as unknown as TaskRowWithProject), error: null };
}

/** Per-project completion tallies used by project progress.
 *  Only the two columns needed — cheap even for a full table. */
export async function getTaskStats(): Promise<Map<string, TaskStats>> {
  const supabase = await createServerSupabase();
  const stats = new Map<string, TaskStats>();
  if (!supabase) return stats;

  const { data, error } = await supabase.from("tasks").select("project_id, status");
  if (error || !data) {
    if (error) console.warn("[tasks] stats query failed:", error.message);
    return stats;
  }
  for (const row of data as unknown as Array<{ project_id: string; status: string | null }>) {
    tallyTask(stats, row.project_id, isTaskStatus(row.status) ? row.status : "todo");
  }
  return stats;
}
