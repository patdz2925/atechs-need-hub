/* ============================================================
   Reports module — client-side mutations (browser Supabase
   client, cookie session). Every write is enforced by RLS +
   the validate_task_report() trigger — these calls only carry
   the payload; the database decides.
   UI gating mirrors src/lib/reports/types.ts:
     create/submit/edit-own → the reporter (RLS: assignment +
       draft/returned states)
     review (start/approve/return) → president, VP,
       department_head in-scope (RLS review policy)
     delete → president, or reporter on own drafts
   NOTE to future notifications/activity work: report submitted /
   returned / approved events should fan out from these three
   functions (submitReport / returnReport / approveReport).
   ============================================================ */

import { getBrowserSupabase } from "@/lib/supabase/client";
import type { ReportStatus } from "./types";

export interface ReportFormValues {
  taskId: string;
  projectId: string;
  title: string;
  summary: string;
  details: string;
  blockers: string;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export type ReportContext =
  | "create"
  | "edit"
  | "submit"
  | "review"
  | "delete";

function friendly(context: ReportContext, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "The database schema is out of date — run supabase/task-reports.sql in the Supabase SQL Editor, then try again.";
  }
  if (m.includes("row-level security")) {
    if (context === "create") return "You can only file reports for tasks assigned to you.";
    if (context === "submit") return "Only the reporter can submit their own draft or returned report.";
    if (context === "review") return "You don't have review rights on this report.";
    if (context === "delete") return "Only the president can delete reports (you can delete your own drafts).";
    return "You don't have permission to edit this report.";
  }
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  // validate_task_report() trigger messages are already human-readable.
  return message;
}

function assertClient() {
  const supabase = getBrowserSupabase();
  if (!supabase) return { error: "Supabase isn't configured. Add credentials to .env.local." };
  return { supabase };
}

function contentPayload(values: ReportFormValues): Record<string, unknown> {
  return {
    task_id: values.taskId,
    project_id: values.projectId,
    title: values.title.trim(),
    summary: values.summary.trim() || null,
    details: values.details.trim() || null,
    blockers: values.blockers.trim() || null,
  };
}

/** File a draft for an assigned task. RLS: reporter = self, task
 *  assigned to self, project matches the task, status starts draft. */
export async function createReport(
  values: ReportFormValues,
  reporterId: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { data, error } = await client.supabase
    .from("task_reports")
    .insert({ ...contentPayload(values), reporter_id: reporterId, status: "draft" })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: friendly("create", error?.message ?? "Could not create the report.") };
  }
  return { ok: true, id: String(data.id) };
}

/** Edit content of an own draft/returned report (president: any
 *  non-approved). Status untouched — use submitReport/review actions. */
export async function updateReportContent(
  id: string,
  values: ReportFormValues
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("task_reports")
    .update(contentPayload(values))
    .eq("id", id);

  if (error) return { ok: false, error: friendly("edit", error.message) };
  return { ok: true };
}

/** Reporter moves own draft/returned report into the review queue. */
export async function submitReport(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("task_reports")
    .update({ status: "submitted" satisfies ReportStatus })
    .eq("id", id);

  if (error) return { ok: false, error: friendly("submit", error.message) };
  return { ok: true };
}

/** Reviewer picks a submitted report up (→ under review). */
export async function startReview(id: string, reviewerId: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("task_reports")
    .update({ status: "under_review" satisfies ReportStatus, reviewer_id: reviewerId })
    .eq("id", id);

  if (error) return { ok: false, error: friendly("review", error.message) };
  return { ok: true };
}

/** Reviewer approves (terminal — read-only afterwards). Notes optional
 *  but encouraged; pass an empty string to skip. */
export async function approveReport(
  id: string,
  reviewerId: string,
  notes: string
): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("task_reports")
    .update({
      status: "approved" satisfies ReportStatus,
      reviewer_id: reviewerId,
      review_notes: notes.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendly("review", error.message) };
  return { ok: true };
}

/** Reviewer returns the report for rework. Notes are REQUIRED
 *  (trigger-enforced) — the reporter must see what has to change. */
export async function returnReport(
  id: string,
  reviewerId: string,
  notes: string
): Promise<MutationResult> {
  if (!notes.trim()) return { ok: false, error: "Add review notes explaining what must change." };
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase
    .from("task_reports")
    .update({
      status: "returned" satisfies ReportStatus,
      reviewer_id: reviewerId,
      review_notes: notes.trim(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: friendly("review", error.message) };
  return { ok: true };
}

/** President anywhere; reporters only their own drafts (RLS). */
export async function deleteReport(id: string): Promise<MutationResult> {
  const client = assertClient();
  if ("error" in client) return { ok: false, error: client.error };

  const { error } = await client.supabase.from("task_reports").delete().eq("id", id);
  if (error) return { ok: false, error: friendly("delete", error.message) };
  return { ok: true };
}
