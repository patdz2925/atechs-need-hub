/* ============================================================
   Reports module — server-side queries (App Router components).
   Cookie-authenticated server client, publishable key only.
   RLS decides visibility; these never bypass it.
   ============================================================ */

import { createServerSupabase } from "@/lib/supabase/server";
import { toReport, type Report, type ReportRow } from "./types";

/** Titles/department ride along via FK embeds so rows render without
 *  extra fetches. Reporter/reviewer NAMES resolve via the member
 *  directory in the page layer (profiles stays SELECT-own). */
const REPORT_SELECT = `
  id, task_id, project_id, reporter_id, title, summary, details,
  blockers, status, reviewer_id, review_notes, submitted_at,
  reviewed_at, created_at, updated_at,
  tasks ( id, title, project_id ),
  projects ( id, title, department_id )
`;

interface ReportRowWithEmbeds extends ReportRow {
  tasks: { id: string; title: string; project_id: string } | null;
  projects: { id: string; title: string; department_id: string | null } | null;
}

function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("schema cache") || m.includes("does not exist")) {
    return "Database schema out of date — run supabase/task-reports.sql in the Supabase SQL Editor, then retry.";
  }
  if (m.includes("row-level security")) return "You don't have permission to view these reports.";
  if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
  return message;
}

type RawReport = Omit<Report, "reporterName" | "reviewerName">;

function hydrate(row: ReportRowWithEmbeds): RawReport {
  const { reporterName: _rn, reviewerName: _vn, ...rest } = toReport(row);
  return rest;
}

/** Every report the viewer's RLS allows — the source for the overview,
 *  dashboard slices and per-task/per-project sections (org-sized data,
 *  filtered client-side like projects/tasks). */
export async function getReports(): Promise<{ reports: RawReport[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { reports: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("task_reports")
    .select(REPORT_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[reports] list query failed:", error.message);
    return { reports: [], error: humanize(error.message) };
  }
  return {
    reports: ((data ?? []) as unknown as ReportRowWithEmbeds[]).map(hydrate),
    error: null,
  };
}

/** One report. `report: null` + `error: null` ⇒ not found (or invisible). */
export async function getReport(
  id: string
): Promise<{ report: RawReport | null; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { report: null, error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("task_reports")
    .select(REPORT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[reports] detail query failed:", error.message);
    return { report: null, error: humanize(error.message) };
  }
  if (!data) return { report: null, error: null };
  return { report: hydrate(data as unknown as ReportRowWithEmbeds), error: null };
}

/** Reports filed on one task (task detail → Reports section). */
export async function getTaskReports(
  taskId: string
): Promise<{ reports: RawReport[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { reports: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("task_reports")
    .select(REPORT_SELECT)
    .eq("task_id", taskId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[reports] task query failed:", error.message);
    return { reports: [], error: humanize(error.message) };
  }
  return {
    reports: ((data ?? []) as unknown as ReportRowWithEmbeds[]).map(hydrate),
    error: null,
  };
}

/** Reports filed inside one project (project workspace → Reports tab). */
export async function getProjectReports(
  projectId: string
): Promise<{ reports: RawReport[]; error: string | null }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { reports: [], error: "Supabase isn't configured." };

  const { data, error } = await supabase
    .from("task_reports")
    .select(REPORT_SELECT)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[reports] project query failed:", error.message);
    return { reports: [], error: humanize(error.message) };
  }
  return {
    reports: ((data ?? []) as unknown as ReportRowWithEmbeds[]).map(hydrate),
    error: null,
  };
}
