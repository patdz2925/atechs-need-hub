/* ============================================================
   Tasks module — domain types & pure mappings.
   Schema discovered by supabase/tasks-inspect.sql (READ-ONLY):
     tasks (
       id uuid PK,
       title text,
       description text,
       project_id uuid → projects,
       assignee_id uuid → profiles,
       status task_status  = todo | in_progress | review | done,
       priority <enum>     = low | normal | medium | high | urgent | critical,
       due_date date,
       created_at timestamptz,
       created_by uuid → profiles
     )
   NOT present (never written by this module):
     start_date, completed_at, updated_at, department_id,
     position, tags, assigned_to, progress
   Tasks are always project-owned — there is no standalone task.
   ============================================================ */

import { can, type Role } from "@/lib/roles";

/* ---------- Enums (mirror the DB enums exactly) ---------- */

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export type TaskPriority =
  | "low"
  | "normal"
  | "medium"
  | "high"
  | "urgent"
  | "critical";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
};

/** Full pipeline shown in filters/chips — DB order of the workflow. */
export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];

/** Suggested forward transitions (UI affordance, not a DB constraint). */
export const NEXT_STATUS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "done"],
  in_progress: ["review", "done"],
  review: ["done", "in_progress"],
  done: ["todo"], // reopen
};

export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (TASK_STATUSES as string[]).includes(v);
}

export function isTaskPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && v in TASK_PRIORITY_LABEL;
}

export function taskPriorityFrom(v: string | null | undefined): TaskPriority {
  return isTaskPriority(v) ? v : "normal";
}

/* ---------- Row / view shapes ---------- */

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  assignee_id: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  description: string;
  assigneeId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  createdBy: string | null;
}

export function toTask(row: TaskRow, projectTitle = ""): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle,
    title: row.title,
    description: row.description ?? "",
    assigneeId: row.assignee_id,
    status: isTaskStatus(row.status) ? row.status : "todo",
    priority: taskPriorityFrom(row.priority),
    dueDate: row.due_date,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/* ---------- Date / due-date states ---------- */

/** Local-midnight-safe parse (date-only strings must not shift a day). */
function parseDate(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTaskDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MS_DAY = 86_400_000;

export type DueState = "none" | "done" | "overdue" | "due_soon" | "upcoming";

/** Visual due-date state. Completed work is never "overdue". */
export function dueState(task: Pick<Task, "dueDate" | "status">): DueState {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "none";
  const due = parseDate(task.dueDate);
  if (!due) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / MS_DAY);
  if (days < 0) return "overdue";
  if (days <= 2) return "due_soon";
  return "upcoming";
}

export const DUE_LABEL: Record<DueState, string> = {
  none: "No due date",
  done: "Completed",
  overdue: "Overdue",
  due_soon: "Due soon",
  upcoming: "Upcoming",
};

/* ---------- Project progress (task-derived) ---------- */

/** Completion counts used to derive a project's progress bar. */
export interface TaskStats {
  total: number;
  done: number;
}

/** Merge a task's status into a per-project tally. */
export function tallyTask(stats: Map<string, TaskStats>, projectId: string, status: TaskStatus): void {
  const cur = stats.get(projectId) ?? { total: 0, done: 0 };
  cur.total += 1;
  if (status === "done") cur.done += 1;
  stats.set(projectId, cur);
}

/* ---------- Search / filter / sort ---------- */

export const TASK_STATUS_CHIPS: Array<{ key: "all" | TaskStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export type TaskSortKey = "due" | "created" | "priority" | "status";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  normal: 4,
  low: 5,
};

/** Sort: undated tasks always fall behind dated ones. */
export function sortTasks(list: Task[], sort: TaskSortKey): Task[] {
  const out = [...list];
  const byNewest = (a: Task, b: Task) => b.createdAt.localeCompare(a.createdAt);
  switch (sort) {
    case "due":
      out.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return byNewest(a, b);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
    case "priority":
      out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byNewest(a, b));
      break;
    case "status": {
      const rank: Record<TaskStatus, number> = {
        in_progress: 0,
        review: 1,
        todo: 2,
        done: 3,
      };
      out.sort((a, b) => rank[a.status] - rank[b.status] || byNewest(a, b));
      break;
    }
    default:
      out.sort(byNewest);
  }
  return out;
}

export interface TaskFilters {
  query: string;
  status: "all" | TaskStatus;
  priority: "all" | TaskPriority;
  projectId: "all" | string;
  assigneeId: "all" | string;
  /** "open" = not done · "overdue" = past due & not done · "done" = completed
   *  · "due_soon" = within 2 days · "scheduled" = has a due date */
  due: "all" | "open" | "overdue" | "due_soon" | "done" | "scheduled";
}

export function filterTasks(list: Task[], f: TaskFilters): Task[] {
  const q = f.query.trim().toLowerCase();
  return list.filter((t) => {
    if (q && !t.title.toLowerCase().includes(q)) return false;
    if (f.status !== "all" && t.status !== f.status) return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;
    if (f.projectId !== "all" && t.projectId !== f.projectId) return false;
    if (f.assigneeId !== "all" && (t.assigneeId ?? "") !== f.assigneeId) return false;
    if (f.due !== "all") {
      const s = dueState(t);
      if (f.due === "open" && t.status === "done") return false;
      if (f.due === "done" && t.status !== "done") return false;
      if (f.due === "overdue" && s !== "overdue") return false;
      if (f.due === "due_soon" && s !== "due_soon" && s !== "overdue") return false;
      if (f.due === "scheduled" && !t.dueDate) return false;
    }
    return true;
  });
}

/* ---------- Permissions (thin wrappers over PERMISSIONS) ---------- */

export interface TaskActions {
  /** Create a task in a project (matrix: president). */
  create: boolean;
  /** Edit any field of any task (matrix: president + VP). */
  edit: boolean;
  /** Reassign the assignee (matrix: manage → president). */
  assign: boolean;
}

/**
 * Role-level task permissions. Nothing here widens PERMISSIONS:
 *   create → can(role,"create")   edit → can(role,"edit")
 *   assign → can(role,"manage")
 * Separately, ANY member may change the status of a task assigned to
 * THEM (isAssignee) — that is own-work progress, not record management,
 * and it is scoped to one column on one row they own.
 */
export function taskActions(role: Role): TaskActions {
  return {
    create: can(role, "create"),
    edit: can(role, "edit"),
    assign: can(role, "manage"),
  };
}

/** May the viewer change this task's status? Own task, or edit rights.
 *  Scope for a non-editor is ONE column (status) on rows already assigned
 *  to them — title, due date, priority and assignee stay off-limits. */
export function canChangeStatus(
  role: Role,
  task: Pick<Task, "assigneeId">,
  viewerId: string
): boolean {
  return can(role, "edit") || (task.assigneeId !== null && task.assigneeId === viewerId);
}

/** Full-field edit is exactly the matrix's `edit` (president + VP). */
export function canEditTask(role: Role): boolean {
  return can(role, "edit");
}
