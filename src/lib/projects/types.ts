/* ============================================================
   Projects module — domain types & pure mappings.
   Reconciled schema (supabase/projects-reconcile.sql):
     stage     → project_stage enum (planned, live, accomplished,
                 archived, on_hold + upcoming, cancelled added)
     priority  → project_priority enum (low/normal/high/urgent)
     NO `status` column — status is DERIVED from `stage` here.
     archive   → stage "archived" + archived_at timestamp (kept in sync)
   ============================================================ */

import { can, type Role } from "@/lib/roles";

/* ---------- Enums (mirror the DB enums) ---------- */

export type ProjectStage =
  | "planned"
  | "upcoming"
  | "live"
  | "accomplished"
  | "archived"
  | "on_hold"
  | "cancelled";

export type ProjectPriority = "low" | "normal" | "high" | "urgent";

/** App-level lifecycle status: the spec's six + legacy `on_hold`
 *  (kept as a possible DB value; never written by the app). */
export type ProjectStatus =
  | "planning"
  | "upcoming"
  | "active"
  | "completed"
  | "archived"
  | "cancelled"
  | "on_hold";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
  on_hold: "On hold",
};

export const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const STAGE_TO_STATUS: Record<ProjectStage, ProjectStatus> = {
  planned: "planning",
  upcoming: "upcoming",
  live: "active",
  accomplished: "completed",
  archived: "archived",
  on_hold: "on_hold",
  cancelled: "cancelled",
};

const STATUS_TO_STAGE: Record<ProjectStatus, ProjectStage> = {
  planning: "planned",
  upcoming: "upcoming",
  active: "live",
  completed: "accomplished",
  archived: "archived",
  cancelled: "cancelled",
  on_hold: "on_hold",
};

export function stageFromStatus(status: ProjectStatus): ProjectStage {
  return STATUS_TO_STAGE[status] ?? "planned";
}

/** stage → status, with the archive flag taking precedence
 *  (archived_at set OR stage archived ⇒ archived). */
export function statusFromStage(
  stage: string | null | undefined,
  archivedAt?: string | null
): ProjectStatus {
  if (archivedAt) return "archived";
  return STAGE_TO_STATUS[(stage ?? "planned") as ProjectStage] ?? "planning";
}

export function priorityFrom(value: string | null | undefined): ProjectPriority {
  return value && value in PRIORITY_LABEL ? (value as ProjectPriority) : "normal";
}

/** Statuses offered in the CREATE form (a project cannot be created archived). */
export const CREATE_STATUSES: ProjectStatus[] = [
  "planning",
  "upcoming",
  "active",
  "completed",
  "cancelled",
];

/** Statuses offered in the EDIT form. `archived` is only offered to roles
 *  that may archive (president) — see PROJECT action permissions. */
export function editStatuses(canArchive: boolean, current: ProjectStatus): ProjectStatus[] {
  const list: ProjectStatus[] = [...CREATE_STATUSES];
  if (canArchive) list.push("archived");
  if (!list.includes(current)) list.push(current); // never lose the current value
  return list;
}

/** Display progress, resolved in this order:
 *  1. completed/archived stage → 100 (stage wins)
 *  2. project has tasks → done ÷ total × 100  (Tasks module drives it)
 *  3. otherwise → the legacy stage rule (planning/upcoming = 0, else the
 *     stored `progress` column, clamped 0–100).
 *  `progress` is never written by task mutations — it is display-only here. */
export function deriveProgress(
  status: ProjectStatus,
  stored: number | null | undefined,
  taskStats?: { total: number; done: number } | null
): number {
  if (status === "completed" || status === "archived") return 100;
  if (taskStats && taskStats.total > 0) {
    return Math.min(
      100,
      Math.max(0, Math.round((taskStats.done / taskStats.total) * 100))
    );
  }
  if (status === "planning" || status === "upcoming") return 0;
  const n = Math.round(stored ?? 0);
  return Math.min(100, Math.max(0, n));
}

/* ---------- Row / view shapes ---------- */

export interface ProjectMemberLink {
  profile_id: string;
  role: string | null;
}

export interface ProjectDeptLink {
  department_id: string;
  departments: { name: string } | null;
}

/** Raw row shape returned by the projects select (see queries.ts). */
export interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  stage: string | null;
  priority: string | null;
  project_type: string | null;
  location: string | null;
  department_id: string | null;
  start_date: string | null;
  end_date: string | null;
  progress: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  project_members: ProjectMemberLink[] | null;
  project_departments: ProjectDeptLink[] | null;
  /** Comma-separated media URLs (images/videos) for the event banner. */
  media: string | null;
}

export interface AssignedMember {
  profileId: string;
  /** Assigned role inside the project ("Lead" / "Member" …) — project_members.role */
  assignedRole: string;
}

/** View model the UI consumes (all derived fields resolved). */
export interface Project {
  id: string;
  title: string;
  description: string;
  stage: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  projectType: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  /** Task completion driving `progress` (0/0 when the project has none). */
  taskTotal: number;
  taskDone: number;
  departmentIds: string[];
  departmentNames: string[];
  members: AssignedMember[];
  /** Comma-separated media URLs for the event banner. */
  media: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  isArchived: boolean;
}

/** Department row (public.departments). */
export interface Department {
  id: string;
  name: string;
  description: string | null;
}

/** Safe directory entry from the member_directory() RPC.
 *  Only the fields required for assignment/display — never emails. */
export interface DirectoryMember {
  id: string;
  name: string;
  role: string;
  department_id: string | null;
  department_name: string | null;
}

/** Row → view model. `deptNameById` resolves the primary department name
 *  for rows whose project_departments link is missing.
 *  `taskStats` (from tasks/queries.getTaskStats) drives the progress bar. */
export function toProject(
  row: ProjectRow,
  deptNameById: Record<string, string> = {},
  taskStats?: { total: number; done: number } | null
): Project {
  const status = statusFromStage(row.stage, row.archived_at);
  const links = row.project_departments ?? [];

  const deptIds: string[] = [];
  const deptNames: string[] = [];
  const pushDept = (id: string | null | undefined, name: string | null | undefined) => {
    if (id && !deptIds.includes(id)) deptIds.push(id);
    if (name && !deptNames.includes(name)) deptNames.push(name);
  };
  links.forEach((l) => pushDept(l.department_id, l.departments?.name));
  pushDept(row.department_id, row.department_id ? deptNameById[row.department_id] : null);

  const members: AssignedMember[] = (row.project_members ?? []).map((m) => ({
    profileId: m.profile_id,
    assignedRole: m.role?.trim() || "Member",
  }));

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    stage: row.stage ?? "planned",
    status,
    priority: priorityFrom(row.priority),
    projectType: row.project_type ?? "",
    location: row.location ?? "",
    startDate: row.start_date,
    endDate: row.end_date,
    progress: deriveProgress(status, row.progress, taskStats),
    taskTotal: taskStats?.total ?? 0,
    taskDone: taskStats?.done ?? 0,
    departmentIds: deptIds,
    departmentNames: deptNames,
    members,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    isArchived: status === "archived",
    media: row.media ?? null,
  };
}

/* ---------- Display helpers ---------- */

export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/** Parse both date-only ("2026-09-30") and timestamp values without the
 *  UTC-midnight day-shift that `new Date("YYYY-MM-DD")` causes. */
function parseDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  const s = start ? formatDate(start) : "";
  const e = end ? formatDate(end) : "";
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s || e || "No dates set";
}

/* ---------- Search / filter / sort (client-side on the list page) ---------- */

export const STATUS_CHIPS: Array<{ key: "all" | ProjectStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "planning", label: "Planning" },
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
  { key: "cancelled", label: "Cancelled" },
];

export type SortKey = "created" | "updated" | "upcoming" | "priority";

const PRIORITY_RANK: Record<ProjectPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function sortProjects(list: Project[], sort: SortKey): Project[] {
  const out = [...list];
  const byNewest = (a: Project, b: Project) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "updated":
      out.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
      break;
    case "upcoming": {
      // Soonest upcoming start first; already-started/ended projects fall
      // behind (most recent first), undated ones last.
      const today = new Date().toISOString().slice(0, 10);
      out.sort((a, b) => {
        const da = a.startDate ?? a.endDate ?? null;
        const db = b.startDate ?? b.endDate ?? null;
        if (!da && !db) return byNewest(a, b);
        if (!da) return 1;
        if (!db) return -1;
        const aFuture = da >= today;
        const bFuture = db >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture ? da.localeCompare(db) : db.localeCompare(da);
      });
      break;
    }
    case "priority":
      out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byNewest(a, b));
      break;
    default:
      out.sort(byNewest);
  }
  return out;
}

export function filterProjects(
  list: Project[],
  opts: {
    query: string;
    status: "all" | ProjectStatus;
    priority: "all" | ProjectPriority;
    projectType: "all" | string;
    departmentId: "all" | string;
  }
): Project[] {
  const q = opts.query.trim().toLowerCase();
  return list.filter((p) => {
    if (q && !p.title.toLowerCase().includes(q)) return false;
    if (opts.status !== "all" && p.status !== opts.status) return false;
    if (opts.priority !== "all" && p.priority !== opts.priority) return false;
    if (opts.projectType !== "all" && p.projectType !== opts.projectType) return false;
    if (opts.departmentId !== "all" && !p.departmentIds.includes(opts.departmentId)) return false;
    return true;
  });
}

/* ---------- Permission shortcuts (thin wrappers over the roles matrix) ---------- */

export interface ProjectActions {
  create: boolean;
  edit: boolean;
  archive: boolean;
  manage: boolean;
}

export function projectActions(role: Role): ProjectActions {
  // Thin view over PERMISSIONS (src/lib/roles.ts stays the source of truth):
  // create = president · edit = president+VP · the matrix groups
  // Archive/Delete under the president · assignments = manage (president).
  return {
    create: can(role, "create"),
    edit: can(role, "edit"),
    archive: can(role, "delete"),
    manage: can(role, "manage"),
  };
}
