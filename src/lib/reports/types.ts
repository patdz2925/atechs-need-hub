/* ============================================================
   Reports module — domain types & pure mappings.
   Schema: supabase/task-reports.sql
     task_reports (
       id uuid PK,
       task_id uuid → tasks (cascade),
       project_id uuid → projects (cascade),
       reporter_id uuid → profiles (restrict),
       title text, summary text, details text, blockers text?,
       status text = draft | submitted | under_review | approved | returned,
       reviewer_id uuid? → profiles (set null),
       review_notes text?, submitted_at?, reviewed_at?,
       created_at, updated_at
     )
   Reports only REFERENCE projects/tasks/profiles — they never
   duplicate project or task data.
   ============================================================ */

import { can, type Role } from "@/lib/roles";

/* ---------- Status lifecycle ---------- */

export type ReportStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "returned";

export const REPORT_STATUSES: ReportStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "returned",
];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  returned: "Returned",
};

export function isReportStatus(v: unknown): v is ReportStatus {
  return typeof v === "string" && (REPORT_STATUSES as string[]).includes(v);
}

/** Forward transitions of the lifecycle (UI affordance, not a DB
 *  constraint — RLS + the validate_task_report() trigger enforce). */
export const NEXT_REPORT_STATUS: Record<ReportStatus, ReportStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "approved", "returned"],
  under_review: ["approved", "returned"],
  returned: ["draft", "submitted"],
  approved: [], // terminal — read-only for everyone
};

/** Reporter-owned states (editable + submittable by the reporter). */
export function isReporterState(status: ReportStatus): boolean {
  return status === "draft" || status === "returned";
}

/** States sitting in somebody's review queue. */
export function isReviewState(status: ReportStatus): boolean {
  return status === "submitted" || status === "under_review";
}

/* ---------- Row / view shapes ---------- */

export interface ReportRow {
  id: string;
  task_id: string;
  project_id: string;
  reporter_id: string;
  title: string;
  summary: string | null;
  details: string | null;
  blockers: string | null;
  status: string | null;
  reviewer_id: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** View model the UI consumes. Titles/names arrive via FK embeds and
 *  the member directory — never duplicated into the report row. */
export interface Report {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectTitle: string;
  /** Primary department of the project (review scoping). */
  projectDeptId: string | null;
  reporterId: string;
  reporterName: string;
  status: ReportStatus;
  title: string;
  summary: string;
  details: string;
  blockers: string;
  reviewerId: string | null;
  reviewerName: string;
  reviewNotes: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportEmbeds {
  tasks?: { id: string; title: string; project_id: string } | null;
  projects?: { id: string; title: string; department_id: string | null } | null;
}

export function toReport(
  row: ReportRow & ReportEmbeds,
  reporterName = "",
  reviewerName = ""
): Report {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.tasks?.title ?? "",
    projectId: row.project_id,
    projectTitle: row.projects?.title ?? "",
    projectDeptId: row.projects?.department_id ?? null,
    reporterId: row.reporter_id,
    reporterName,
    status: isReportStatus(row.status) ? row.status : "draft",
    title: row.title,
    summary: row.summary ?? "",
    details: row.details ?? "",
    blockers: row.blockers ?? "",
    reviewerId: row.reviewer_id,
    reviewerName,
    reviewNotes: row.review_notes ?? "",
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DirectoryName {
  id: string;
  name: string;
}

/** Resolve reporter/reviewer display names from the member directory
 *  (profiles stays SELECT-own — names never come from it directly). */
export function resolveReportNames<T extends { reporterId: string; reviewerId: string | null }>(
  reports: T[],
  directory: DirectoryName[]
): (T & { reporterName: string; reviewerName: string })[] {
  const names = new Map(directory.map((d) => [d.id, d.name]));
  return reports.map((r) => ({
    ...r,
    reporterName: names.get(r.reporterId) ?? "Unknown member",
    reviewerName: r.reviewerId ? (names.get(r.reviewerId) ?? "Unknown member") : "",
  }));
}

/* ---------- Search / filter / sort ---------- */

/** Slim row for dashboard panels + compact lists (mapped from Report
 *  in the dashboard service layer — same PROJECT → TASK attribution,
 *  no duplicated data). */
export interface ReportListItem {
  id: string;
  title: string;
  project: string;
  author: string;
  reporterId: string;
  date: string;
  status: ReportStatus;
}

export const REPORT_STATUS_CHIPS: Array<{ key: "all" | ReportStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "returned", label: "Returned" },
];

export type ReportScope = "mine" | "review" | "all";

export type ReportSortKey = "updated" | "submitted" | "created" | "title";

export interface ReportFilters {
  query: string;
  status: "all" | ReportStatus;
  projectId: "all" | string;
  reporterId: "all" | string;
  sort: ReportSortKey;
}

export function filterReports<T extends Report>(
  list: T[],
  f: ReportFilters,
  viewerId: string,
  scope: ReportScope,
  viewerDeptId: string | null,
  role: Role
): T[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((r) => {
    if (scope === "mine" && r.reporterId !== viewerId) return false;
    if (scope === "review" && !(isReviewState(r.status) && canReviewReport(role, viewerDeptId, r)))
      return false;
    if (q && !`${r.title} ${r.summary}`.toLowerCase().includes(q)) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.projectId !== "all" && r.projectId !== f.projectId) return false;
    if (f.reporterId !== "all" && r.reporterId !== f.reporterId) return false;
    return true;
  });
}

export function sortReports<T extends Report>(list: T[], sort: ReportSortKey): T[] {
  const out = [...list];
  const byNewest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "submitted":
      out.sort(
        (a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") || byNewest(a, b)
      );
      break;
    case "created":
      out.sort(byNewest);
      break;
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title) || byNewest(a, b));
      break;
    default:
      out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byNewest(a, b));
  }
  return out;
}

/* ---------- Permissions (thin wrappers over PERMISSIONS) ---------- */

export interface ReportActions {
  /** File a report for an assigned task (any signed-in member; the
   *  task picker + RLS assignment check do the real scoping). */
  create: boolean;
  /** Review queue visible without restriction (president + VP). */
  reviewAll: boolean;
  /** Full oversight incl. delete-anywhere (president). */
  manageAll: boolean;
}

export function reportActions(role: Role): ReportActions {
  return {
    create: true,
    reviewAll: role === "president" || role === "vice_president",
    manageAll: can(role, "manage"),
  };
}

/** May the viewer review THIS report? President/VP anywhere;
 *  department heads inside their own department (project-scoped,
 *  mirroring the RLS review policy). Everyone else: no. */
export function canReviewReport(
  role: Role,
  viewerDeptId: string | null,
  report: Pick<Report, "projectDeptId">
): boolean {
  if (role === "president" || role === "vice_president") return true;
  if (role === "department_head" && viewerDeptId) {
    return report.projectDeptId === viewerDeptId;
  }
  return false;
}

/** May the viewer edit the report CONTENT? Reporter on own
 *  draft/returned; president on anything non-approved. (VP edits
 *  flow through review actions — see mutations.) */
export function canEditReportContent(
  role: Role,
  viewerId: string,
  report: Pick<Report, "reporterId" | "status">
): boolean {
  if (report.status === "approved") return false;
  if (report.reporterId === viewerId && isReporterState(report.status)) return true;
  return role === "president";
}

/** May the viewer (re)submit this report? Reporter on own draft/returned. */
export function canSubmitReport(
  _role: Role,
  viewerId: string,
  report: Pick<Report, "reporterId" | "status">
): boolean {
  return report.reporterId === viewerId && isReporterState(report.status);
}

/** May the viewer delete this report? President anywhere; reporters
 *  only their own drafts. */
export function canDeleteReport(
  role: Role,
  viewerId: string,
  report: Pick<Report, "reporterId" | "status">
): boolean {
  if (role === "president") return true;
  return report.reporterId === viewerId && report.status === "draft";
}
