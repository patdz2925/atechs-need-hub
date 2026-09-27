"use client";

/* ============================================================
   Task create/edit form.
   Only the columns that exist on `tasks`:
     title, description, project_id, assignee_id, status,
     priority, due_date  (+ created_by on insert)
   Assignment uses member_directory() output — never emails.
   ============================================================ */

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  canEditTask,
  taskActions,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/types";
import type { DirectoryMember } from "@/lib/projects/types";
import { initialsOf } from "@/lib/projects/types";
import { createTask, updateTask, type TaskFormValues } from "@/lib/tasks/mutations";
import type { Role } from "@/lib/roles";

interface TaskFormProps {
  mode: "create" | "edit";
  role: Role;
  viewerId: string;
  projectId: string;
  projectTitle?: string;
  initial: Task | null;
  directory: DirectoryMember[];
  /** Close the inline form (create panel / edit panel). */
  onCancel?: () => void;
}

export default function TaskForm({
  mode,
  role,
  viewerId,
  projectId,
  projectTitle,
  initial,
  directory,
  onCancel,
}: TaskFormProps) {
  const router = useRouter();
  const actions = taskActions(role);
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? "");
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /* Reassignment is president-only (can manage); everyone else sees who
     holds the task but cannot change it. */
  const canAssign = actions.assign;
  const canPickStatus = canEditTask(role);
  const assigneeOptions = useMemo(
    () => [...directory].sort((a, b) => a.name.localeCompare(b.name)),
    [directory]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (!title.trim()) {
      setError("A title is required.");
      return;
    }

    const values: TaskFormValues = {
      title,
      description,
      assigneeId: assigneeId || null,
      status,
      priority,
      dueDate,
    };

    setBusy(true);
    try {
      const result = isEdit
        ? await updateTask(initial!.id, values, projectId)
        : await createTask(values, projectId, viewerId);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      onCancel?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="tk-form" onSubmit={onSubmit} noValidate={false}>
      {error && (
        <p className="pj-err" role="alert">
          {error}
        </p>
      )}

      <div className="pj-form-grid">
        <div className="field pj-span-2">
          <label htmlFor="tk-title">Task title *</label>
          <input
            id="tk-title"
            type="text"
            required
            maxLength={140}
            placeholder="e.g. Create promotional poster"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field pj-span-2">
          <label htmlFor="tk-desc">Description</label>
          <textarea
            id="tk-desc"
            rows={3}
            maxLength={2000}
            placeholder="What needs to be done, and what does done look like?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="tk-assignee">Assignee</label>
          {canAssign ? (
            <select
              id="tk-assignee"
              className="pj-input-select"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.department_name ? ` — ${m.department_name}` : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="tk-readonly">
              {assigneeId
                ? directory.find((m) => m.id === assigneeId)?.name ?? "Assigned member"
                : "Unassigned"}
              <span>Only the president can reassign tasks.</span>
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="tk-priority">Priority</label>
          <select
            id="tk-priority"
            className="pj-input-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {(Object.keys(TASK_PRIORITY_LABEL) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tk-due">Due date</label>
          <input
            id="tk-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="tk-status">Status</label>
          {canPickStatus ? (
            <select
              id="tk-status"
              className="pj-input-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          ) : (
            <p className="tk-readonly">
              {TASK_STATUS_LABEL[status]}
              <span>Update your own task&rsquo;s status from its card.</span>
            </p>
          )}
        </div>
      </div>

      {!isEdit && projectTitle && (
        <p className="tk-form-note">
          Adding to <b>{projectTitle}</b>
        </p>
      )}

      <div className="pj-form-actions">
        <button className="pj-btn pj-btn--primary" type="submit" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create task"}
        </button>
        {onCancel ? (
          <button type="button" className="pj-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : (
          <Link href={`/hub/projects/${projectId}`} className="pj-btn">
            Back to project
          </Link>
        )}
        {initial?.assigneeId && canAssign && (
          <span className="pj-member-av pj-member-av--sm" aria-hidden="true">
            {initialsOf(directory.find((m) => m.id === initial.assigneeId)?.name ?? "?")}
          </span>
        )}
      </div>
    </form>
  );
}
