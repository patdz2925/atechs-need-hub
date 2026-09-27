"use client";

/* ============================================================
   /hub/projects/[id] — project workspace.
   Server page fetches the data; this client shell owns the
   tabs + archive action. Overview, Tasks and Reports are live —
   the other tabs are declared here so future modules (Media,
   Activity) plug straight in.
   ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { StatusPill } from "@/components/hub/widgets";
import ArchiveButton from "./ArchiveButton";
import DeleteButton from "./DeleteButton";
import ProjectReports from "@/components/reports/ProjectReports";
import ProjectMedia from "@/components/media/ProjectMedia";
import ProjectTasks from "@/components/tasks/ProjectTasks";
import {
  PRIORITY_LABEL,
  formatDateTime,
  formatDateRange,
  initialsOf,
  projectActions,
  type Department,
  type DirectoryMember,
  type Project,
} from "@/lib/projects/types";
import type { Task } from "@/lib/tasks/types";
import type { Report } from "@/lib/reports/types";
import type { FolderCardData } from "@/lib/media/queries";
import type { MediaItem } from "@/lib/media/types";
import { ROLE_LABEL, isRole, type Role } from "@/lib/roles";

interface ProjectWorkspaceProps {
  role: Role;
  /** Viewer profile id — server session, used for own-task checks. */
  viewerId: string;
  project: Project;
  directory: DirectoryMember[];
  departments: Department[];
  /** Real tasks for the Tasks tab (RLS-filtered server-side). */
  tasks: Task[];
  /** Real reports for the Reports tab (RLS-filtered server-side). */
  reports: Report[];
  /** Recent media for the Media tab (RLS-filtered server-side). */
  media: MediaItem[];
  /** Project-linked folders for the Media tab. */
  projectFolders: FolderCardData[];
  /** Media registration shortcut (contributors). */
  canCreateMedia: boolean;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "reports", label: "Reports" },
  { key: "media", label: "Media" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ProjectWorkspace({
  role,
  viewerId,
  project,
  directory,
  departments,
  tasks,
  reports,
  media,
  projectFolders,
  canCreateMedia,
}: ProjectWorkspaceProps) {
  const [tab, setTab] = useState<TabKey>("overview");
  const actions = projectActions(role);

  const byId = useMemo(() => new Map(directory.map((d) => [d.id, d])), [directory]);
  const deptById = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const creatorName = project.createdBy
    ? byId.get(project.createdBy)?.name ?? "Unknown member"
    : "—";

  /* Assigned members: leads first, directory-resolved display info. */
  const members = useMemo(() => {
    return project.members
      .map((m) => {
        const info = byId.get(m.profileId);
        return {
          profileId: m.profileId,
          assignedRole: m.assignedRole,
          name: info?.name ?? "Unknown member",
          orgRole: info?.role,
          department: info?.department_name ?? "",
        };
      })
      .sort((a, b) => {
        const leadA = a.assignedRole.toLowerCase() === "lead" ? 0 : 1;
        const leadB = b.assignedRole.toLowerCase() === "lead" ? 0 : 1;
        return leadA - leadB || a.name.localeCompare(b.name);
      });
  }, [project.members, byId]);

  const facts = [
    { k: "Schedule", v: formatDateRange(project.startDate, project.endDate) },
    { k: "Location", v: project.location || "—" },
    { k: "Type", v: project.projectType || "—" },
    { k: "Priority", v: PRIORITY_LABEL[project.priority] },
  ];

  return (
    <div className="pj-workspace">
      <Link href="/hub/projects" className="pj-back">
        <ChevronLeft size={14} aria-hidden="true" /> All projects
      </Link>

      {project.isArchived && (
        <div className="pj-banner" role="status">
          <span>
            <strong>Archived</strong>
            {project.archivedAt ? ` on ${formatDateRange(null, project.archivedAt)}` : ""} — hidden
            from active work but kept visible here
            {actions.edit && ". Use Edit to move it back to an active stage."}
          </span>
        </div>
      )}

      <Reveal direction="up" distance={24}>
        <header className="panel pj-detail-head">
          <div className="pj-title-row">
            <div>
              <div className="pj-pills">
                <StatusPill status={project.status} />
                <span className={`pj-pri pj-pri--${project.priority}`}>
                  {PRIORITY_LABEL[project.priority]}
                </span>
                {project.projectType && <span className="pj-tag">{project.projectType}</span>}
              </div>
              <h1>{project.title}</h1>
              <p className="pj-detail-sub">
                {project.description || "No description yet."}
              </p>
            </div>

            <div className="pj-actions">
              {actions.edit && (
                <Link href={`/hub/projects/${project.id}/edit`} className="pj-btn">
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Link>
              )}
              {!project.isArchived && actions.archive && (
                <ArchiveButton projectId={project.id} />
              )}
              {actions.archive && (
                <DeleteButton
                  projectId={project.id}
                  projectTitle={project.title}
                  redirectTo="/hub/projects"
                />
              )}
            </div>
          </div>

          <div className="pj-facts">
            {facts.map((f) => (
              <div className="pj-fact" key={f.k}>
                <div className="k">{f.k}</div>
                <div className={`v${f.v === "—" ? " muted" : ""}`}>{f.v}</div>
              </div>
            ))}
          </div>
        </header>
      </Reveal>

      {/* Tabs — Overview + Tasks + Reports live; the rest declared for future modules */}
      <div className="pj-tabs" role="tablist" aria-label="Project workspace sections">
        {TABS.map((t) =>
          t.key === "overview" || t.key === "tasks" || t.key === "reports" || t.key === "media" ? (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`pj-tab${tab === t.key ? " is-active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === "tasks" && tasks.length > 0 && (
                <small className="pj-tab-count">{tasks.length}</small>
              )}
              {t.key === "reports" && reports.length > 0 && (
                <small className="pj-tab-count">{reports.length}</small>
              )}
              {t.key === "media" && media.length > 0 && (
                <small className="pj-tab-count">{media.length}</small>
              )}
            </button>
          ) : (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={false}
              className="pj-tab"
              disabled
              title="Arrives in a later milestone"
            >
              {t.label}
              <small>soon</small>
            </button>
          )
        )}
      </div>

      <div className="pj-overview" key={tab} role="tabpanel" aria-label={tab === "tasks" ? "Tasks" : tab === "reports" ? "Reports" : tab === "media" ? "Media" : "Overview"}>
        {tab === "tasks" ? (
          <div className="tk-tabpane">
            <ProjectTasks
              role={role}
              viewerId={viewerId}
              project={project}
              tasks={tasks}
              directory={directory}
            />
          </div>
        ) : tab === "reports" ? (
          <div className="tk-tabpane">
            <ProjectReports reports={reports} />
          </div>
        ) : tab === "media" ? (
          <div className="tk-tabpane">
            <ProjectMedia
              projectId={project.id}
              items={media}
              folders={projectFolders}
              canCreate={canCreateMedia}
              canMapProject={role === "president"}
              projects={[{ id: project.id, title: project.title }]}
              proxyFirst={role === "president"}
            />
          </div>
        ) : (
          <>
            {/* ---- About + progress (driven by real task completion) ---- */}
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>About</h2>
                  <span className="panel-hint">Description &amp; progress</span>
                </div>
              </div>
              <p className="pj-about">{project.description || "No description yet."}</p>

              <div className="pj-progress-head">
                <span>Progress</span>
                <b>{project.progress}%</b>
              </div>
              <div className="progress">
                <span style={{ width: `${project.progress}%` }} />
              </div>
              <p className="pj-progress-note">
                {project.taskTotal > 0
                  ? `Derived from tasks: ${project.taskDone} of ${project.taskTotal} complete.`
                  : "Progress follows the project stage until tasks are added — then it becomes done ÷ total."}
              </p>
            </section>
          </>
        )}

        {tab === "overview" && (
          <>
            {/* ---- Departments ---- */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Departments</h2>
              <span className="panel-hint">
                {project.departmentNames.length
                  ? `${project.departmentNames.length} involved`
                  : "None assigned"}
              </span>
            </div>
          </div>
          {project.departmentIds.length ? (
            <div className="pj-tags pj-tags--roomy">
              {project.departmentIds.map((id) => (
                <span className="pj-tag" key={id}>
                  {deptById.get(id)?.name ?? project.departmentNames.find((n) => n) ?? "Department"}
                </span>
              ))}
            </div>
          ) : (
            <p className="empty">No departments assigned.</p>
          )}
        </section>

        {/* ---- Members ---- */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Members</h2>
              <span className="panel-hint">
                {members.length ? `${members.length} assigned` : "None assigned"}
              </span>
            </div>
          </div>
          {members.length ? (
            <div className="list">
              {members.map((m) => (
                <div className="pj-member" key={m.profileId}>
                  <span className="pj-member-av" aria-hidden="true">
                    {initialsOf(m.name)}
                  </span>
                  <div className="pj-member-info">
                    <b>{m.name}</b>
                    <span>
                      {m.orgRole && isRole(m.orgRole) ? ROLE_LABEL[m.orgRole] : "Member"}
                      {m.department ? ` · ${m.department}` : ""}
                    </span>
                  </div>
                  <span className="pj-assigned">{m.assignedRole}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">No members assigned yet.</p>
          )}
        </section>

        {/* ---- Metadata ---- */}
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Metadata</h2>
              <span className="panel-hint">Audit trail</span>
            </div>
          </div>
          <div className="pj-meta-list">
            <div>
              <span className="k">Created by</span>
              <span className="v">{creatorName}</span>
            </div>
            <div>
              <span className="k">Created</span>
              <span className="v">{formatDateTime(project.createdAt) || "—"}</span>
            </div>
            <div>
              <span className="k">Updated</span>
              <span className="v">{formatDateTime(project.updatedAt) || "—"}</span>
            </div>
            <div>
              <span className="k">Completed</span>
              <span className="v">{formatDateTime(project.completedAt) || "—"}</span>
            </div>
            <div>
              <span className="k">Archived</span>
              <span className="v">{formatDateTime(project.archivedAt) || "—"}</span>
            </div>
            <div>
              <span className="k">Stage</span>
              <span className="v">{project.stage}</span>
            </div>
            </div>
          </section>
          </>
        )}
      </div>
    </div>
  );
}
