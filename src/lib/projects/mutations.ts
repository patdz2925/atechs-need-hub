/* ============================================================
   Projects module — client-side mutations (browser Supabase
   client, cookie session). Every write is enforced by RLS:
     insert   → president only        (projects_president_insert)
     update   → president + VP        (projects_edit)
     delete   → president only        (projects_president_delete)
     assignments → president only     (project_members/project_departments
                                       *_president_manage)
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";
import { stageFromStatus, type ProjectPriority, type ProjectStatus } from "./types";

export interface ProjectFormValues {
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  projectType: string;
  location: string;
  startDate: string; // "" allowed
  endDate: string;
  departmentIds: string[];
  members: { profileId: string; role: string }[];
  /** Comma-separated banner/media URLs (projects.media) — null clears it. */
  media: string | null;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function friendly(context: "create" | "edit" | "assign" | "delete", message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/projects-reconcile.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) {
    if (context === "create") return "Only the president can create projects.";
    if (context === "assign") return "Only the president can manage assignments.";
    if (context === "delete") return "Only the president can delete projects.";
    return "You don't have permission to edit this project.";
  }
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

function assertClient() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: "Supabase isn't configured. Add credentials to .env.local." };
  return { supabase };
}

const now = () => new Date().toISOString();

function projectInsertPayload(values: ProjectFormValues, createdBy: string) {
  const status = values.status;
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    stage: stageFromStatus(status),
    priority: values.priority,
    project_type: values.projectType.trim() || null,
    location: values.location.trim() || null,
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    department_id: values.departmentIds[0] ?? null,
    media: values.media,
    created_by: createdBy,
    completed_at: status === "completed" ? now() : null,
  };
}

/** President-only creation. Inserts the project, then its department +
 *  member links; rolls the project back if the links fail so no orphan
 *  record is left behind. */
export async function createProject(
  values: ProjectFormValues,
  createdBy: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const supabase = client.supabase;

  const { data, error } = await supabase
    .from("projects")
    .insert(projectInsertPayload(values, createdBy))
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: friendly("create", error?.message ?? "Could not create the project.") };
  }
  const id = String(data.id);

  // Assignments (RLS: president manage)
  if (values.departmentIds.length) {
    const { error: deptErr } = await supabase.from("project_departments").insert(
      values.departmentIds.map((department_id) => ({ project_id: id, department_id }))
    );
    if (deptErr) {
      await supabase.from("projects").delete().eq("id", id); // best-effort rollback
      return { ok: false, error: friendly("assign", `Could not save departments: ${deptErr.message}`) };
    }
  }

  if (values.members.length) {
    const { error: memberErr } = await supabase.from("project_members").insert(
      values.members.map((m) => ({
        project_id: id,
        profile_id: m.profileId,
        role: m.role || "Member",
      }))
    );
    if (memberErr) {
      await supabase.from("projects").delete().eq("id", id); // best-effort rollback
      return { ok: false, error: friendly("assign", `Could not save members: ${memberErr.message}`) };
    }
  }

  return { ok: true, id };
}

export interface UpdateOptions {
  /** Assignments may only be written by the president (manage). */
  manageAssignments: boolean;
  /** Current archive/completed timestamps — preserved when unchanged. */
  currentArchivedAt: string | null;
  currentCompletedAt: string | null;
}

/** President/VP edit. Assignment tables are only touched when the viewer
 *  has `manage` (president) — RLS would reject anyone else anyway. */
export async function updateProject(
  id: string,
  values: ProjectFormValues,
  opts: UpdateOptions
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const supabase = client.supabase;
  const status = values.status;

  const { error } = await supabase
    .from("projects")
    .update({
      title: values.title.trim(),
      description: values.description.trim() || null,
      stage: stageFromStatus(status),
      priority: values.priority,
      project_type: values.projectType.trim() || null,
      location: values.location.trim() || null,
      start_date: values.startDate || null,
      end_date: values.endDate || null,
      department_id: values.departmentIds[0] ?? null,
      media: values.media,
      archived_at: status === "archived" ? opts.currentArchivedAt ?? now() : null,
      completed_at:
        status === "completed"
          ? opts.currentCompletedAt ?? now()
          : status === "archived"
            ? opts.currentCompletedAt ?? null
            : null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendly("edit", error.message) };

  if (!opts.manageAssignments) return { ok: true };

  // Replace department links
  const { error: deptDel } = await supabase.from("project_departments").delete().eq("project_id", id);
  if (deptDel) return { ok: false, error: friendly("assign", deptDel.message) };
  if (values.departmentIds.length) {
    const { error: deptIns } = await supabase.from("project_departments").insert(
      values.departmentIds.map((department_id) => ({ project_id: id, department_id }))
    );
    if (deptIns) return { ok: false, error: friendly("assign", deptIns.message) };
  }

  // Replace member links
  const { error: memDel } = await supabase.from("project_members").delete().eq("project_id", id);
  if (memDel) return { ok: false, error: friendly("assign", memDel.message) };
  if (values.members.length) {
    const { error: memIns } = await supabase.from("project_members").insert(
      values.members.map((m) => ({
        project_id: id,
        profile_id: m.profileId,
        role: m.role || "Member",
      }))
    );
    if (memIns) return { ok: false, error: friendly("assign", memIns.message) };
  }

  return { ok: true };
}

/** President-only archive: stage → archived + archived_at timestamp.
 *  (Soft-delete — the record stays visible in the workspace.) */
export async function archiveProject(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const { error } = await client.supabase
    .from("projects")
    .update({ stage: "archived", archived_at: now() })
    .eq("id", id);
  if (error) return { ok: false, error: friendly("edit", error.message) };
  return { ok: true };
}

/** President-only hard delete (RLS: projects_president_delete).
 *  Used by the hub project list + detail workspace. Related
 *  member/department links cascade at the database level. */
export async function deleteProject(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };
  const { error } = await client.supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: friendly("delete", error.message) };
  return { ok: true };
}
