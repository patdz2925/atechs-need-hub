"use client";

/* ============================================================
   Tasks module — shared presentational pieces.
   Status pills use the REAL task_status enum labels
   (todo / in_progress / review / done), never invented values.
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, UserRound } from "lucide-react";
import {
  DUE_LABEL,
  NEXT_STATUS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  canChangeStatus,
  canEditTask,
  dueState,
  formatTaskDate,
  type DueState,
  type Task,
  type TaskStatus,
} from "@/lib/tasks/types";
import { initialsOf } from "@/lib/projects/types";
import type { Role } from "@/lib/roles";
import { setTaskStatus } from "@/lib/tasks/mutations";

/* ---------- Status pill (real enum → label) ---------- */

const PILL_CLASS: Record<TaskStatus, string> = {
  todo: "pill",
  in_progress: "pill pill--active",
  review: "pill pill--up",
  done: "pill pill--live",
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return <span className={PILL_CLASS[status]}>{TASK_STATUS_LABEL[status]}</span>;
}

/* ---------- Due-date badge ---------- */

const DUE_CLASS: Record<DueState, string> = {
  none: "tk-due",
  done: "tk-due tk-due--done",
  upcoming: "tk-due",
  due_soon: "tk-due tk-due--soon",
  overdue: "tk-due tk-due--over",
};

export function DueBadge({ task }: { task: Task }) {
  const state = dueState(task);
  if (state === "none") {
    return (
      <span className={DUE_CLASS.none}>
        <CalendarDays size={12} aria-hidden="true" />
        No due date
      </span>
    );
  }
  if (state === "done") {
    return (
      <span className={DUE_CLASS.done}>
        <CalendarDays size={12} aria-hidden="true" />
        {DUE_LABEL.done}
      </span>
    );
  }
  return (
    <span className={DUE_CLASS[state]} title={DUE_LABEL[state]}>
      <CalendarDays size={12} aria-hidden="true" />
      {formatTaskDate(task.dueDate)}
      {state !== "upcoming" && <b>· {DUE_LABEL[state]}</b>}
    </span>
  );
}

/* ---------- Task card ---------- */

interface TaskCardProps {
  task: Task;
  role: Role;
  viewerId: string;
  /** Used to resolve assignee names (member_directory output). */
  directory: Array<{ id: string; name: string; role?: string; department_name?: string | null }>;
  /** Show the project chip (My Tasks / cross-project lists). */
  showProject?: boolean;
  /** Fired after a successful status change so the server can refresh. */
  onChanged?: () => void;
}

export function TaskCard({
  task,
  role,
  viewerId,
  directory,
  showProject = false,
  onChanged,
}: TaskCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assignee = task.assigneeId
    ? directory.find((m) => m.id === task.assigneeId)
    : undefined;

  const statusEditable = canChangeStatus(role, task, viewerId);
  const editable = canEditTask(role);

  const quickStatuses: TaskStatus[] = NEXT_STATUS[task.status];

  async function onStatus(value: TaskStatus) {
    if (busy || value === task.status) return;
    setBusy(true);
    setError("");
    const res = await setTaskStatus(task.id, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not update the status.");
      return;
    }
    onChanged?.();
    router.refresh();
  }

  return (
    <article className="tk-card">
      <div className="tk-card-top">
        <div className="pj-pills">
          <TaskStatusPill status={task.status} />
          <span className={`tk-pri tk-pri--${task.priority}`}>
            {TASK_PRIORITY_LABEL[task.priority]}
          </span>
        </div>
        <DueBadge task={task} />
      </div>

      <div className="tk-card-body">
        <h4 className="tk-card-title">
          <Link href={`/hub/tasks/${task.id}`}>{task.title}</Link>
        </h4>
        {task.description && <p className="tk-card-desc">{task.description}</p>}
      </div>

      <div className="tk-card-meta">
        {showProject && task.projectTitle && (
          <Link className="tk-proj" href={`/hub/projects/${task.projectId}`}>
            {task.projectTitle}
            <ChevronRight size={12} aria-hidden="true" />
          </Link>
        )}
        <span className="tk-who">
          {assignee ? (
            <>
              <span className="pj-member-av pj-member-av--sm" aria-hidden="true">
                {initialsOf(assignee.name)}
              </span>
              {assignee.name}
            </>
          ) : (
            <>
              <UserRound size={12} aria-hidden="true" />
              Unassigned
            </>
          )}
        </span>
        <span className="tk-created">Added {formatTaskDate(task.createdAt)}</span>
      </div>

      {(statusEditable || editable) && (
        <div className="tk-card-actions">
          {statusEditable && (
            <select
              className="pj-mini-select"
              aria-label={`Status for ${task.title}`}
              value={task.status}
              disabled={busy}
              onChange={(e) => onStatus(e.target.value as TaskStatus)}
            >
              <option value={task.status}>{TASK_STATUS_LABEL[task.status]}</option>
              {quickStatuses
                .filter((s) => s !== task.status)
                .map((s) => (
                  <option key={s} value={s}>
                    → {TASK_STATUS_LABEL[s]}
                  </option>
                ))}
            </select>
          )}
          {editable && (
            <Link className="pj-btn tk-edit" href={`/hub/tasks/${task.id}`}>
              Open
            </Link>
          )}
          {error && (
            <span className="tk-err" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
