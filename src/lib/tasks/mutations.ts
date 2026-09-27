/* ============================================================
   Tasks module — client-side mutations (browser Supabase client,
   cookie session). Every write is enforced by RLS — these calls
   only carry the payload; the database decides.
   UI gating mirrors src/lib/roles.ts PERMISSIONS:
     create → president           (can create)
     edit   → president + VP      (can edit)
     assign → president           (can manage)
     status → edit rights OR the task's own assignee
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";
import type { TaskPriority, TaskStatus } from "./types";

export interface TaskFormValues {
  title: string;
  description: string;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** "" allowed (no due date). */
  dueDate: string;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export type TaskContext = "create" | "edit" | "assign" | "status";

function friendly(context: TaskContext, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/tasks-inspect.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) {
    if (context === "create") return "Only the president can create tasks.";
    if (context === "assign") return "Only the president can assign tasks.";
    if (context === "status") return "You can only update the status of your own tasks.";
    return "You don't have permission to edit this task.";
  }
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

function assertClient() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: "Supabase isn't configured. Add credentials to .env.local." };
  return { supabase };
}

/** Only the columns that exist on `tasks` (see tasks-inspect.sql). */
function payload(
  values: TaskFormValues,
  projectId: string,
  createdBy?: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: values.title.trim(),
    description: values.description.trim() || null,
    project_id: projectId,
    assignee_id: values.assigneeId,
    status: values.status,
    priority: values.priority,
    due_date: values.dueDate || null,
  };
  if (createdBy) body.created_by = createdBy;
  return body;
}

/** President-only creation inside a project. */
export async function createTask(
  values: TaskFormValues,
  projectId: string,
  createdBy: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { data, error } = await client.supabase
    .from("tasks")
    .insert(payload(values, projectId, createdBy))
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: friendly("create", error?.message ?? "Could not create the task.") };
  }
  return { ok: true, id: String(data.id) };
}

/** Full edit (president/VP). */
export async function updateTask(
  id: string,
  values: TaskFormValues,
  projectId: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("tasks")
    .update(payload(values, projectId))
    .eq("id", id);

  if (error) return { ok: false, error: friendly("edit", error.message) };
  return { ok: true };
}

/** Status-only transition — the narrow path a member uses on their own
 *  task. Writes one column; RLS still decides whether it's allowed. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return { ok: false, error: friendly("status", error.message) };
  return { ok: true };
}

/** Reassign only (president — `manage`). */
export async function setTaskAssignee(
  id: string,
  assigneeId: string | null
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("tasks")
    .update({ assignee_id: assigneeId })
    .eq("id", id);
  if (error) return { ok: false, error: friendly("assign", error.message) };
  return { ok: true };
}
