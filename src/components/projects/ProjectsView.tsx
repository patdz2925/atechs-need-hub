"use client";

/* ============================================================
   /hub/projects — project list with search, filters and sort.
   Purely presentational over the server-fetched props; all
   filtering/sorting is client-side (data volume is one org).
   ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FolderOpen, MapPin, Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { StatusPill } from "@/components/hub/widgets";
import DeleteButton from "./DeleteButton";
import {
  PRIORITY_LABEL,
  STATUS_CHIPS,
  STATUS_LABEL,
  filterProjects,
  formatDateRange,
  initialsOf,
  projectActions,
  sortProjects,
  type Department,
  type DirectoryMember,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  type SortKey,
} from "@/lib/projects/types";
import type { Role } from "@/lib/roles";

interface ProjectsViewProps {
  role: Role;
  projects: Project[];
  directory: DirectoryMember[];
  departments: Department[];
  loadError: string | null;
}

/* ---------- Card ---------- */

function ProjectCard({
  project,
  directory,
}: {
  project: Project;
  directory: DirectoryMember[];
}) {
  const byId = useMemo(() => new Map(directory.map((d) => [d.id, d])), [directory]);
  const shown = project.members.slice(0, 4);
  const extra = project.members.length - shown.length;

  return (
    <Link href={`/hub/projects/${project.id}`} className="pj-card">
      <div className="pj-card-top">
        <div className="pj-pills">
          <StatusPill status={project.status} />
          <span className={`pj-pri pj-pri--${project.priority}`}>
            {PRIORITY_LABEL[project.priority]}
          </span>
        </div>
        {project.isArchived && <span className="pill">Archived</span>}
      </div>

      <h3 className="pj-card-title">{project.title}</h3>
      {project.description && <p className="pj-card-desc">{project.description}</p>}

      <div className="pj-card-meta">
        <span>
          <CalendarDays size={12} aria-hidden="true" />
          {formatDateRange(project.startDate, project.endDate)}
        </span>
        {project.location && (
          <span>
            <MapPin size={12} aria-hidden="true" />
            {project.location}
          </span>
        )}
        {project.projectType && <span>{project.projectType}</span>}
      </div>

      {project.departmentNames.length > 0 && (
        <div className="pj-tags">
          {project.departmentNames.slice(0, 3).map((name) => (
            <span className="pj-tag" key={name}>
              {name}
            </span>
          ))}
          {project.departmentNames.length > 3 && (
            <span className="pj-tag">+{project.departmentNames.length - 3}</span>
          )}
        </div>
      )}

      <div className="pj-card-foot">
        <div className="pj-people">
          <div className="pj-avatars" aria-hidden="true">
            {shown.map((m) => (
              <span className="pj-av" key={m.profileId}>
                {initialsOf(byId.get(m.profileId)?.name ?? "Member")}
              </span>
            ))}
            {extra > 0 && <span className="pj-av pj-av--more">+{extra}</span>}
          </div>
          <span className="pj-member-count">
            {project.members.length} {project.members.length === 1 ? "member" : "members"}
          </span>
        </div>
        <span className="pj-progress-num">{project.progress}%</span>
      </div>
      <div className="progress pj-progress" aria-hidden="true">
        <span style={{ width: `${project.progress}%` }} />
      </div>
    </Link>
  );
}

/* ---------- View ---------- */

const PRIORITY_OPTIONS: Array<{ key: "all" | ProjectPriority; label: string }> = [
  { key: "all", label: "Any priority" },
  { key: "urgent", label: "Urgent" },
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
];

export default function ProjectsView({
  role,
  projects,
  directory,
  departments,
  loadError,
}: ProjectsViewProps) {
  const router = useRouter();
  const actions = projectActions(role);
  // Matrix groups Archive/Delete under the president — the hub list
  // exposes hard delete through the same gate as archiving.
  const canDelete = actions.archive;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ProjectStatus>("all");
  const [priority, setPriority] = useState<"all" | ProjectPriority>("all");
  const [projectType, setProjectType] = useState<"all" | string>("all");
  const [departmentId, setDepartmentId] = useState<"all" | string>("all");
  const [sort, setSort] = useState<SortKey>("created");

  const typeOptions = useMemo(() => {
    const set = new Set(projects.map((p) => p.projectType).filter(Boolean));
    return [...set].sort();
  }, [projects]);

  const visible = useMemo(
    () =>
      sortProjects(
        filterProjects(projects, { query, status, priority, projectType, departmentId }),
        sort
      ),
    [projects, query, status, priority, projectType, departmentId, sort]
  );

  const hasFilters =
    query.trim() !== "" ||
    status !== "all" ||
    priority !== "all" ||
    projectType !== "all" ||
    departmentId !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setPriority("all");
    setProjectType("all");
    setDepartmentId("all");
  };

  /* ----- error state ----- */
  if (loadError) {
    return (
      <>
        <div className="pj-head">
          <div>
            <h1>Projects</h1>
            <p className="pj-head-sub">Plan → Assign → Work → Report → Review → Complete → Archive</p>
          </div>
        </div>
        <div className="pj-alert" role="alert">
          <span>
            Couldn&rsquo;t load projects: <strong>{loadError}</strong>
          </span>
          <button type="button" className="pj-btn" onClick={() => router.refresh()}>
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pj-head">
        <div>
          <h1>Projects</h1>
          <p className="pj-head-sub">
            Plan → Assign → Work → Report → Review → Complete → Archive
          </p>
        </div>
        <div className="pj-head-actions">
          {actions.create && (
            <Link href="/hub/projects/new" className="pj-btn pj-btn--primary">
              <Plus size={14} aria-hidden="true" />
              New project
            </Link>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="pj-empty">
          <span className="pj-empty-icon" aria-hidden="true">
            <FolderOpen size={24} />
          </span>
          <h3>No projects yet</h3>
          <p>
            {actions.create
              ? "Create the first project to start tracking plans, departments, members and progress in one place."
              : "Projects will appear here as soon as the president creates them."}
          </p>
          {actions.create && (
            <Link href="/hub/projects/new" className="pj-btn pj-btn--primary">
              <Plus size={14} aria-hidden="true" />
              Create the first project
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="pj-toolbar">
            <input
              className="pj-search"
              type="search"
              placeholder="Search by title…"
              aria-label="Search projects by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="pj-select"
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as "all" | ProjectPriority)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Filter by project type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            >
              <option value="all">Any type</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Filter by department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="all">Any department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Sort projects"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="created">Recently created</option>
              <option value="updated">Recently updated</option>
              <option value="upcoming">Upcoming</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div className="pj-chips">
            {STATUS_CHIPS.map((chip) => (
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
                    ? projects.length
                    : projects.filter((p) => p.status === chip.key).length}
                </span>
              </button>
            ))}
          </div>

          <p className="pj-count">
            Showing {visible.length} of {projects.length}{" "}
            {projects.length === 1 ? "project" : "projects"}
            {hasFilters && (
              <button type="button" className="pj-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          {visible.length ? (
            <div className="pj-grid">
              {visible.map((p, i) => (
                <Reveal
                  key={p.id}
                  className="pj-grid-item"
                  delay={Math.min(i, 8) * 60}
                  distance={24}
                >
                  {/* Card stays a plain link; the delete action lives in
                      its own row below so no button ever nests in the anchor. */}
                  <div className="pj-card-col">
                    <ProjectCard project={p} directory={directory} />
                    {canDelete && (
                      <div className="pj-card-actions">
                        <DeleteButton projectId={p.id} projectTitle={p.title} />
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="pj-empty pj-empty--filtered">
              <span className="pj-empty-icon" aria-hidden="true">
                <FolderOpen size={24} />
              </span>
              <h3>No matching projects</h3>
              <p>
                Nothing matches the current search
                {status !== "all" ? ` in ${STATUS_LABEL[status]}` : ""} and filters.
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
