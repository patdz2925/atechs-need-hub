"use client";

/* ============================================================
   Task detail — /hub/tasks/[id].
   Shows the task's real columns, its project link, assignee,
   status/priority/due state, plus:
     · status transitions for editors AND the assignee
     · full edit for editors (president/VP)
     · reports filed on the task (+ file a new one)
   No comments, attachments or activity log (out of scope).
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import {
  DUE_LABEL,
  NEXT_STATUS,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  canChangeStatus,
  canEditTask,
  dueState,
  formatTaskDate,
  taskActions,
  type Task,
  type TaskStatus,
} from "@/lib/tasks/types";
import type { DirectoryMember } from "@/lib/projects/types";
import type { Report } from "@/lib/reports/types";
import { setTaskStatus } from "@/lib/tasks/mutations";
import { ROLE_LABEL, isRole, type Role } from "@/lib/roles";
import { DueBadge, TaskStatusPill } from "./TaskBits";
import TaskForm from "./TaskForm";
import TaskReports from "@/components/reports/TaskReports";

interface TaskDetailProps {
  role: Role;
  viewerId: string;
  task: Task;
  directory: DirectoryMember[];
  /** Reports filed on this task (RLS-filtered server-side). */
  reports: Report[];
}

export default function TaskDetail({ role, viewerId, task, directory, reports }: TaskDetailProps) {
  const router = useRouter();
  const actions = taskActions(role);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assignee = task.assigneeId
    ? directory.find((m) => m.id === task.assigneeId)
    : undefined;
  const creator = task.createdBy
    ? directory.find((m) => m.id === task.createdBy)
    : undefined;

  const statusEditable = canChangeStatus(role, task, viewerId);
  const editable = canEditTask(role);
  const state = dueState(task);

  const facts = [
    { k: "Project", v: task.projectTitle || "—" },
    { k: "Assignee", v: assignee?.name ?? "Unassigned" },
    { k: "Assignee role", v: assignee && isRole(assignee.role) ? ROLE_LABEL[assignee.role] : "—" },
    { k: "Department", v: assignee?.department_name || "—" },
    { k: "Priority", v: TASK_PRIORITY_LABEL[task.priority] },
    { k: "Due", v: formatTaskDate(task.dueDate) || "No due date" },
    { k: "Created", v: formatTaskDate(task.createdAt) },
    { k: "Created by", v: creator?.name ?? "—" },
  ];

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
    router.refresh();
  }

  return (
    <>
      <Link href={`/hub/projects/${task.projectId}`} className="pj-back">
        <ChevronLeft size={14} aria-hidden="true" />
        {task.projectTitle || "Back to project"}
      </Link>

      <Reveal direction="up" distance={24}>
        <header className="panel pj-detail-head">
          <div className="pj-title-row">
            <div>
              <div className="pj-pills">
                <TaskStatusPill status={task.status} />
                <span className={`tk-pri tk-pri--${task.priority}`}>
                  {TASK_PRIORITY_LABEL[task.priority]}
                </span>
                <DueBadge task={task} />
              </div>
              <h1>{task.title}</h1>
              <p className="pj-detail-sub">
                {task.description || "No description yet."}
              </p>
            </div>

            <div className="pj-actions">
              {editable && !editing && (
                <button
                  type="button"
                  className="pj-btn"
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="pj-facts">
            {facts.map((f) => (
              <div className="pj-fact" key={f.k}>
                <div className="k">{f.k}</div>
                <div className={`v${f.v === "—" || f.v === "No due date" ? " muted" : ""}`}>
                  {f.k === "Project" && task.projectTitle ? (
                    <Link href={`/hub/projects/${task.projectId}`}>{f.v}</Link>
                  ) : (
                    f.v
                  )}
                </div>
              </div>
            ))}
          </div>
        </header>
      </Reveal>

      <div className="tk-detail" key={editing ? "editing" : "view"}>
        {editing ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Edit task</h2>
                <span className="panel-hint">President / Vice President</span>
              </div>
            </div>
            <TaskForm
              mode="edit"
              role={role}
              viewerId={viewerId}
              projectId={task.projectId}
              projectTitle={task.projectTitle}
              initial={task}
              directory={directory}
              onCancel={() => setEditing(false)}
            />
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Status</h2>
                  <span className="panel-hint">
                    {!statusEditable
                      ? "View only"
                      : task.assigneeId === viewerId && !actions.edit
                        ? "Your task — update it as you work"
                        : "Transition the task"}
                  </span>
                </div>
              </div>

              <div className="tk-status-row">
                <span className="tk-status-now">
                  {TASK_STATUS_LABEL[task.status]}
                  {state === "overdue" && <b> · {DUE_LABEL.overdue}</b>}
                </span>
                {statusEditable && (
                  <div className="tk-status-next">
                    {NEXT_STATUS[task.status].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`pj-btn${s === "done" ? " pj-btn--confirm" : ""}`}
                        disabled={busy}
                        onClick={() => onStatus(s)}
                      >
                        {s === "done" && task.status !== "done" ? "Mark done" : `→ ${TASK_STATUS_LABEL[s]}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!statusEditable && (
                <p className="pj-note">
                  You can update the status of tasks assigned to you. Ask the president to
                  reassign this one.
                </p>
              )}
              {error && (
                <p className="pj-err" role="alert">
                  {error}
                </p>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Description</h2>
                  <span className="panel-hint">What &ldquo;done&rdquo; means</span>
                </div>
              </div>
              <p className="pj-about">{task.description || "No description yet."}</p>
            </section>

            {!actions.create && (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>More tasks</h2>
                    <span className="panel-hint">Same project</span>
                  </div>
                </div>
                <p className="pj-about">
                  Open the project&rsquo;s <b>Tasks</b> tab to see the rest of the work in{" "}
                  {task.projectTitle || "this project"}.
                </p>
                <div className="pj-form-actions" style={{ marginTop: "0.9rem" }}>
                  <Link href={`/hub/projects/${task.projectId}`} className="pj-btn pj-btn--primary">
                    Open project
                  </Link>
                  <Link href="/hub/tasks" className="pj-btn">
                    My Tasks
                  </Link>
                </div>
              </section>
            )}

            <TaskReports role={role} viewerId={viewerId} task={task} reports={reports} />
          </>
        )}
      </div>
    </>
  );
}
