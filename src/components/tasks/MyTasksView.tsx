"use client";

/* ============================================================
   /hub/tasks — My Tasks.
   Personal work queue for the signed-in member: tasks assigned
   to them first, plus an optional "Everything I can see" scope
   (RLS decides what rows come back — this is just a filter).
   ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import {
  TASK_STATUS_CHIPS,
  dueState,
  filterTasks,
  sortTasks,
  taskActions,
  type Task,
  type TaskFilters,
  type TaskSortKey,
} from "@/lib/tasks/types";
import type { DirectoryMember } from "@/lib/projects/types";
import type { Role } from "@/lib/roles";
import { TaskCard } from "./TaskBits";

interface MyTasksViewProps {
  role: Role;
  viewerId: string;
  viewerName: string;
  tasks: Task[];
  directory: DirectoryMember[];
  loadError: string | null;
}

type Scope = "mine" | "all";

export default function MyTasksView({
  role,
  viewerId,
  viewerName,
  tasks,
  directory,
  loadError,
}: MyTasksViewProps) {
  const router = useRouter();
  const actions = taskActions(role);

  const [scope, setScope] = useState<Scope>("mine");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TaskFilters["status"]>("all");
  const [due, setDue] = useState<TaskFilters["due"]>("all");
  const [projectId, setProjectId] = useState<"all" | string>("all");
  const [assigneeId, setAssigneeId] = useState<"all" | string>("all");
  const [sort, setSort] = useState<TaskSortKey>("due");

  const scoped = useMemo(
    () => (scope === "mine" ? tasks.filter((t) => t.assigneeId === viewerId) : tasks),
    [tasks, scope, viewerId]
  );

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => map.set(t.projectId, t.projectTitle || "Untitled project"));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const visible = useMemo(
    () =>
      sortTasks(
        filterTasks(scoped, { query, status, due, projectId, assigneeId, priority: "all" }),
        sort
      ),
    [scoped, query, status, due, projectId, assigneeId, sort]
  );

  const myOverdue = useMemo(
    () =>
      tasks.filter(
        (t) => t.assigneeId === viewerId && dueState(t) === "overdue"
      ).length,
    [tasks, viewerId]
  );

  const hasFilters =
    query.trim() !== "" ||
    status !== "all" ||
    due !== "all" ||
    projectId !== "all" ||
    assigneeId !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setDue("all");
    setProjectId("all");
    setAssigneeId("all");
  };

  /* ---------- error state ---------- */
  if (loadError) {
    return (
      <>
        <div className="pj-head">
          <div>
            <h1>My Tasks</h1>
            <p className="pj-head-sub">Project → Task → You → Work → Complete</p>
          </div>
        </div>
        <div className="pj-alert" role="alert">
          <span>
            Couldn&rsquo;t load tasks: <strong>{loadError}</strong>
          </span>
          <button type="button" className="pj-btn" onClick={() => router.refresh()}>
            Retry
          </button>
        </div>
      </>
    );
  }

  const mineCount = tasks.filter((t) => t.assigneeId === viewerId).length;

  return (
    <>
      <div className="pj-head">
        <div>
          <h1>My Tasks</h1>
          <p className="pj-head-sub">
            {viewerName}&rsquo;s work queue · Project → Task → You → Work → Complete
          </p>
        </div>
        <div className="pj-head-actions">
          {actions.create && (
            <Link href="/hub/projects" className="pj-btn pj-btn--primary">
              <Plus size={14} aria-hidden="true" />
              New task in a project
            </Link>
          )}
        </div>
      </div>

      {myOverdue > 0 && (
        <div className="pj-banner pj-banner--warn" role="status">
          <span>
            <strong>{myOverdue} overdue {myOverdue === 1 ? "task" : "tasks"}</strong> assigned to
            you — open them below to update their status.
          </span>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="pj-empty">
          <span className="pj-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <h3>No tasks yet</h3>
          <p>
            {actions.create
              ? "Tasks are created inside a project — open one and use its Tasks tab."
              : "Your assigned tasks will appear here as soon as they are created."}
          </p>
          <Link href="/hub/projects" className="pj-btn">
            Browse projects
          </Link>
        </div>
      ) : (
        <>
          <div className="pj-toolbar">
            <input
              className="pj-search"
              type="search"
              placeholder="Search by title…"
              aria-label="Search tasks by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="pj-select"
              aria-label="Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              <option value="mine">Assigned to me ({mineCount})</option>
              <option value="all">Everything I can see ({tasks.length})</option>
            </select>
            <select
              className="pj-select"
              aria-label="Filter by due date"
              value={due}
              onChange={(e) => setDue(e.target.value as TaskFilters["due"])}
            >
              <option value="all">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due soon</option>
              <option value="open">Open</option>
              <option value="done">Completed</option>
              <option value="scheduled">Has a due date</option>
            </select>
            <select
              className="pj-select"
              aria-label="Filter by project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="all">Any project</option>
              {projectOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Filter by assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="all">Anyone</option>
              <option value="">Unassigned</option>
              {directory.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
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
                    ? scoped.length
                    : scoped.filter((t) => t.status === chip.key).length}
                </span>
              </button>
            ))}
          </div>

          <p className="pj-count">
            Showing {visible.length} of {scoped.length}{" "}
            {scoped.length === 1 ? "task" : "tasks"}
            {hasFilters && (
              <button type="button" className="pj-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          {visible.length ? (
            <div className="tk-list tk-list--page">
              {visible.map((t, i) => (
                <Reveal key={t.id} direction="up" distance={18} delay={Math.min(i, 8) * 55}>
                  <TaskCard
                    task={t}
                    role={role}
                    viewerId={viewerId}
                    directory={directory}
                    showProject
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
              <p>
                {scope === "mine" && !hasFilters
                  ? "Nothing is assigned to you right now."
                  : "Nothing matches the current search and filters."}
              </p>
              <button type="button" className="pj-btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
