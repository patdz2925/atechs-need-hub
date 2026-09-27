"use client";

/* ============================================================
   Project workspace → Tasks tab.
   Lists the project's tasks with search/status filters, the
   create form (president), status transitions and an entry to
   each task's detail page. Overview is untouched.
   ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import {
  TASK_STATUS_CHIPS,
  filterTasks,
  sortTasks,
  taskActions,
  type Task,
  type TaskFilters,
  type TaskSortKey,
} from "@/lib/tasks/types";
import type { DirectoryMember, Project } from "@/lib/projects/types";
import type { Role } from "@/lib/roles";
import { TaskCard } from "./TaskBits";
import TaskForm from "./TaskForm";

interface ProjectTasksProps {
  role: Role;
  viewerId: string;
  project: Project;
  tasks: Task[];
  directory: DirectoryMember[];
}

export default function ProjectTasks({
  role,
  viewerId,
  project,
  tasks,
  directory,
}: ProjectTasksProps) {
  const router = useRouter();
  const actions = taskActions(role);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TaskFilters["status"]>("all");
  const [sort, setSort] = useState<TaskSortKey>("due");
  const [creating, setCreating] = useState(false);

  const visible = useMemo(
    () =>
      sortTasks(
        filterTasks(tasks, {
          query,
          status,
          priority: "all",
          projectId: "all",
          assigneeId: "all",
          due: "all",
        }),
        sort
      ),
    [tasks, query, status, sort]
  );

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openCount = tasks.length - doneCount;

  /* ---------- Error / empty states ---------- */
  if (!tasks.length && !actions.create) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Tasks</h2>
            <span className="panel-hint">None yet</span>
          </div>
        </div>
        <div className="pj-empty">
          <span className="pj-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <h3>No tasks in this project yet</h3>
          <p>Tasks appear here once the president adds them to the project.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Tasks</h2>
          <span className="panel-hint">
            {tasks.length
              ? `${doneCount} done · ${openCount} open`
              : "Break the project into assignable work"}
          </span>
        </div>
        {actions.create && !creating && (
          <button type="button" className="pj-btn pj-btn--primary" onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            New task
          </button>
        )}
      </div>

      {creating && (
        <Reveal direction="up" distance={16}>
          <div className="tk-form-wrap">
            <TaskForm
              mode="create"
              role={role}
              viewerId={viewerId}
              projectId={project.id}
              projectTitle={project.title}
              initial={null}
              directory={directory}
              onCancel={() => setCreating(false)}
            />
          </div>
        </Reveal>
      )}

      {!tasks.length ? (
        <div className="pj-empty pj-empty--tight">
          <span className="pj-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <h3>No tasks yet</h3>
          <p>
            {actions.create
              ? "Add the first task so members know what to work on next."
              : "Tasks will appear here once the president creates them."}
          </p>
        </div>
      ) : (
        <>
          <div className="tk-toolbar">
            <input
              className="pj-search"
              type="search"
              placeholder="Search tasks…"
              aria-label="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="pj-select"
              aria-label="Sort tasks"
              value={sort}
              onChange={(e) => setSort(e.target.value as TaskSortKey)}
            >
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="created">Recently added</option>
            </select>
          </div>

          <div className="pj-chips">
            {TASK_STATUS_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`pj-chip${status === chip.key ? " is-active" : ""}`}
                aria-pressed={status === chip.key}
                onClick={() => setStatus(chip.key)}
              >
                {chip.label}
                <span className="pj-chip-count">
                  {chip.key === "all"
                    ? tasks.length
                    : tasks.filter((t) => t.status === chip.key).length}
                </span>
              </button>
            ))}
          </div>

          {visible.length ? (
            <div className="tk-list">
              {visible.map((t, i) => (
                <Reveal key={t.id} direction="up" distance={16} delay={Math.min(i, 8) * 50}>
                  <TaskCard
                    task={t}
                    role={role}
                    viewerId={viewerId}
                    directory={directory}
                    onChanged={() => router.refresh()}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="pj-empty pj-empty--filtered">
              <span className="pj-empty-icon" aria-hidden="true">
                <ClipboardList size={24} />
              </span>
              <h3>No matching tasks</h3>
              <p>Nothing here matches the current search or status filter.</p>
              <button
                type="button"
                className="pj-btn"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}

      <p className="tk-foot-note">
        Need the whole picture?{" "}
        <Link href="/hub/tasks">Open My Tasks</Link> for work assigned to you across projects.
      </p>
    </section>
  );
}
