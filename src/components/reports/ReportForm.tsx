"use client";

/* ============================================================
   Report create/edit form.
   Create: the reporter picks one of THEIR assigned tasks — the
   project derives from the task and can never be changed
   independently; the reporter is always the signed-in viewer
   (server prop, never client input). RLS re-checks all of it.
   Edit: task/project are locked, content stays editable while
   the report is draft/returned. Drafts may stay partial;
   submission requires title + summary + details.
   ============================================================ */

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createReport,
  submitReport,
  updateReportContent,
} from "@/lib/reports/mutations";
import type { Task } from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import type { Report } from "@/lib/reports/types";
import type { Role } from "@/lib/roles";

interface ReportFormProps {
  mode: "create" | "edit";
  viewerId: string;
  role: Role;
  /** All RLS-visible tasks; the picker narrows to assigned-to-me. */
  tasks: Task[];
  projects: Project[];
  /** Deep-link preselect (?task=) — honored only when assigned to me. */
  initialTaskId?: string;
  initial?: Report | null;
  /** Client parents only (detail inline-edit). Create mode navigates
   *  to the new report itself; without onCancel, Cancel links back. */
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

export default function ReportForm({
  mode,
  viewerId,
  role,
  tasks,
  projects,
  initialTaskId,
  initial,
  onSaved,
  onCancel,
}: ReportFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigneeId === viewerId),
    [tasks, viewerId]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const defaultTaskId =
    initial?.taskId ??
    (initialTaskId && myTasks.some((t) => t.id === initialTaskId) ? initialTaskId : "") ??
    "";
  const [taskId, setTaskId] = useState(defaultTaskId || myTasks[0]?.id || "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [blockers, setBlockers] = useState(initial?.blockers ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedTask = isEdit
    ? null
    : (myTasks.find((t) => t.id === taskId) ?? null);
  const selectedProject = isEdit
    ? null
    : selectedTask
      ? (projectById.get(selectedTask.projectId) ?? null)
      : null;

  const missingForSubmit: string[] = [];
  if (!isEdit && !selectedTask) missingForSubmit.push("task");
  if (!title.trim()) missingForSubmit.push("title");
  if (!summary.trim()) missingForSubmit.push("summary");
  if (!details.trim()) missingForSubmit.push("details");

  async function persist(asDraft: boolean): Promise<string | null> {
    if (isEdit && !initial) return null;
    const task = isEdit ? null : selectedTask;
    const projectId = isEdit ? initial!.projectId : (task?.projectId ?? "");
    if (!isEdit && !task) {
      setError("Choose one of your assigned tasks first.");
      return null;
    }
    if (!title.trim()) {
      setError("A report title is required (even for drafts).");
      return null;
    }
    if (!asDraft && missingForSubmit.length) {
      setError(
        `Before submitting, fill in: ${missingForSubmit.join(", ")}. Drafts may stay partial.`
      );
      return null;
    }

    setBusy(true);
    setError("");
    try {
      if (!isEdit) {
        const res = await createReport(
          {
            taskId: task!.id,
            projectId,
            title,
            summary,
            details,
            blockers,
          },
          viewerId
        );
        if (!res.ok || !res.id) {
          setError(res.error ?? "Could not save the report.");
          return null;
        }
        if (!asDraft) {
          const sub = await submitReport(res.id);
          if (!sub.ok) {
            setError(sub.error ?? "Draft saved, but submission failed — reopen it to submit.");
            return res.id;
          }
        }
        return res.id;
      }

      const res = await updateReportContent(initial!.id, {
        taskId: initial!.taskId,
        projectId: initial!.projectId,
        title,
        summary,
        details,
        blockers,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save the report.");
        return null;
      }
      if (!asDraft) {
        const sub = await submitReport(initial!.id);
        if (!sub.ok) {
          setError(sub.error ?? "Changes saved, but submission failed — submit again.");
          return initial!.id;
        }
      }
      return initial!.id;
    } finally {
      setBusy(false);
    }
  }

  async function onAction(asDraft: boolean, e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const id = await persist(asDraft);
    if (id) {
      router.refresh();
      if (onSaved) onSaved(id);
      else if (!isEdit) router.push(`/hub/reports/${id}`);
    }
  }

  /* No assigned tasks → the form cannot function. Say exactly what
     is wrong (visible-but-unassigned vs nothing at all) and how to
     fix it — presidents assign work to themselves. Project
     membership alone does NOT count: the task row itself must name
     you as its assignee. */
  if (!isEdit && myTasks.length === 0) {
    const total = tasks.length;
    const isPresident = role === "president";
    return (
      <div className="pj-empty">
        <h3>You have no assigned tasks available for reporting</h3>
        <p>
          {total > 0
            ? `The hub can see ${total} ${total === 1 ? "task" : "tasks"}, but none ${
                total === 1 ? "is" : "are"
              } assigned to you. Reports can only be filed on tasks that name you as the assignee — being a project member is not enough.`
            : "Reports are filed on work assigned to you, and there are no tasks yet."}{" "}
          {isPresident
            ? "Open a task, Edit it, set Assignee to yourself, save — then come back here."
            : "Ask the president to assign a task to you (task page → Edit → Assignee)."}
        </p>
        <div className="pj-form-actions pj-form-actions--center">
          <Link href="/hub/tasks" className="pj-btn pj-btn--primary">
            Check My Tasks
          </Link>
          {onCancel ? (
            <button type="button" className="pj-btn" onClick={onCancel}>
              Back to reports
            </button>
          ) : (
            <Link href="/hub/reports" className="pj-btn">
              Back to reports
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="pj-form" onSubmit={(e) => onAction(true, e)}>
      {error && (
        <p className="pj-err" role="alert">
          {error}
        </p>
      )}

      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Assignment</h2>
            <span className="panel-hint">What this report covers</span>
          </div>
        </div>
        {isEdit ? (
          <div className="pj-facts">
            <div className="pj-fact">
              <div className="k">Project</div>
              <div className="v">{initial!.projectTitle || "—"}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Task</div>
              <div className="v">{initial!.taskTitle || "—"}</div>
            </div>
          </div>
        ) : (
          <div className="pj-form-grid">
            <div className="field pj-span-2">
              <label htmlFor="rp-task">Task (assigned to you) *</label>
              <select
                id="rp-task"
                className="pj-input-select"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                {myTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} — {t.projectTitle || "Project"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field pj-span-2">
              <span className="pj-static-label">Project (from the task)</span>
              <p className="pj-static-value">
                {selectedProject ? (
                  <Link href={`/hub/projects/${selectedProject.id}`}>
                    {selectedProject.title}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Report</h2>
            <span className="panel-hint">What was accomplished</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field pj-span-2">
            <label htmlFor="rp-title">Report title *</label>
            <input
              id="rp-title"
              type="text"
              required
              maxLength={140}
              placeholder="e.g. Tech Talk stage setup — done"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field pj-span-2">
            <label htmlFor="rp-summary">Summary *</label>
            <textarea
              id="rp-summary"
              rows={3}
              maxLength={2000}
              placeholder="Two or three sentences on what got done…"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
          <div className="field pj-span-2">
            <label htmlFor="rp-details">Details / accomplishments *</label>
            <textarea
              id="rp-details"
              rows={5}
              maxLength={8000}
              placeholder="Steps taken, outcomes, links, numbers…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>
          <div className="field pj-span-2">
            <label htmlFor="rp-blockers">Blockers / issues</label>
            <textarea
              id="rp-blockers"
              rows={3}
              maxLength={2000}
              placeholder="Anything stuck, missing, or at risk… (optional)"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="pj-form-actions">
        <button
          className="pj-btn"
          type="button"
          disabled={busy}
          onClick={(e) => onAction(true, e)}
        >
          {busy ? "Saving…" : isEdit ? "Save draft" : "Save Draft"}
        </button>
        <button
          className="pj-btn pj-btn--primary"
          type="button"
          disabled={busy}
          onClick={(e) => onAction(false, e)}
        >
          {busy ? "Submitting…" : isEdit ? "Save & submit" : "Submit Report"}
        </button>
        {onCancel ? (
          <button type="button" className="pj-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : (
          <Link href="/hub/reports" className="pj-btn">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
