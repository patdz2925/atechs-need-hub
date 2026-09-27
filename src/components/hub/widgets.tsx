/* ============================================================
   Dashboard widgets — presentational only.
   They receive data via props (from the dashboard service
   layer) and never import demo/mock files directly, so mock
   data can be swapped for Supabase queries without touching
   these components.
   ============================================================ */

import type { ReactNode } from "react";
import Link from "next/link";
import type { DemoProject } from "@/data/demoProjects";
import type { ReportListItem } from "@/lib/reports/types";
import type { MediaTile } from "@/lib/media/types";
import { MEDIA_TYPE_LABEL, tileGradient } from "@/lib/media/types";
import type { DemoMember } from "@/data/demoMembers";
import type { DemoActivity } from "@/data/demoActivity";
import type { EventItem } from "@/data/events";
import type { Task } from "@/lib/tasks/types";
import { TASK_PRIORITY_LABEL, formatTaskDate } from "@/lib/tasks/types";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/* ---------- Panel ---------- */
export function Panel({
  title,
  hint,
  action,
  wide,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`panel${wide ? " panel--wide" : ""}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {hint && <span className="panel-hint">{hint}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------- Stat tiles ---------- */
export function StatTiles({ tiles }: { tiles: { value: number | string; label: string }[] }) {
  return (
    <div className="stat-tiles">
      {tiles.map((t) => (
        <div className="stat-tile" key={t.label}>
          <div className="value">{t.value}</div>
          <div className="label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Status pill ---------- */
const BLUE = ["active", "in_progress", "under_review"];
const SKY = ["upcoming", "submitted", "review"];
const GREEN = ["current", "completed", "accomplished", "done", "approved"];

export function StatusPill({ status }: { status: string }) {
  const cls = BLUE.includes(status)
    ? "pill pill--active"
    : SKY.includes(status)
      ? "pill pill--up"
      : GREEN.includes(status)
        ? "pill pill--live"
        : "pill";
  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

/* ---------- Projects ---------- */
export function ProjectCard({ project }: { project: DemoProject }) {
  return (
    <article className="project-card">
      <div className="project-top">
        <div className="project-name">{project.name}</div>
        <StatusPill status={project.status} />
      </div>
      <p className="project-desc">{project.description}</p>
      <div className="project-meta">
        <span>{project.department}</span>
        <span>Lead: {project.owner}</span>
        <span>Due: {project.due}</span>
      </div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${project.progress}%` }} />
      </div>
      <div className="progress-label">
        <span>Progress</span>
        <span>{project.progress}%</span>
      </div>
    </article>
  );
}

export function ProgressRow({ project }: { project: DemoProject }) {
  return (
    <div className="row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title">{project.name}</div>
        <div className="row-meta">
          {project.department} · due {project.due}
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${project.progress}%` }} />
        </div>
      </div>
      <StatusPill status={project.status} />
    </div>
  );
}

/* ---------- Tasks (real Supabase rows — Tasks module) ---------- */
export function TaskRow({ task, showProject = true }: { task: Task; showProject?: boolean }) {
  return (
    <div className="row">
      <div>
        <div className="row-title">{task.title}</div>
        <div className="row-meta">
          {showProject && task.projectTitle && <b>{task.projectTitle}</b>}
          {showProject && task.projectTitle && " · "}
          {task.dueDate ? formatTaskDate(task.dueDate) : "No due date"}
          {" · priority: "}
          {TASK_PRIORITY_LABEL[task.priority].toLowerCase()}
          {!task.assigneeId && " · unassigned"}
        </div>
      </div>
      <StatusPill status={task.status} />
    </div>
  );
}

/* ---------- Reports (real Supabase rows — Reports module) ---------- */
export function ReportRow({
  report,
  showApprove = false,
}: {
  report: ReportListItem;
  showApprove?: boolean;
}) {
  const awaiting = report.status === "submitted" || report.status === "under_review";
  return (
    <div className="row">
      <div>
        <div className="row-title">{report.title}</div>
        <div className="row-meta">
          <b>{report.project}</b> · {report.author} · {report.date}
        </div>
      </div>
      <div className="row-side">
        <StatusPill status={report.status} />
        {showApprove && awaiting && (
          <Link href={`/hub/reports/${report.id}`} className="panel-action">
            Review
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------- Events (reuses the public site's EventItem shape) ---------- */
export function EventRow({ event }: { event: EventItem }) {
  return (
    <div className="row">
      <div>
        <div className="row-title">{event.title}</div>
        <div className="row-meta">
          <b>{event.department}</b> · {event.date}
        </div>
      </div>
      <StatusPill status={event.status} />
    </div>
  );
}

/* ---------- Activity ---------- */
export function ActivityFeed({ items }: { items: DemoActivity[] }) {
  return (
    <ul className="feed">
      {items.map((a) => (
        <li key={a.id}>
          <span className="dot" aria-hidden="true" />
          <p>
            <b>{a.actor}</b> {a.action} <b>{a.target}</b>
            <time>{a.time}</time>
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Media (real Supabase rows — Media Bank module) ---------- */
export function MediaGrid({ items }: { items: MediaTile[] }) {
  return (
    <div className="media-grid">
      {items.map((m) => (
        <article className="media-tile" key={m.id}>
          {m.thumb ? (
            <div className="media-thumb media-thumb--img" aria-hidden="true">
              <img src={m.thumb} alt="" loading="lazy" />
            </div>
          ) : (
            <div className="media-thumb" style={{ background: tileGradient(m.type) }} aria-hidden="true" />
          )}
          <div className="media-body">
            <div className="media-title">{m.title}</div>
            <div className="media-meta">
              {MEDIA_TYPE_LABEL[m.type]} · {m.date}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- Members ---------- */
export function MemberRows({ members }: { members: DemoMember[] }) {
  return (
    <div className="list">
      {members.map((m) => (
        <div className="row" key={m.id}>
          <div>
            <div className="row-title">{m.name}</div>
            <div className="row-meta">{m.department}</div>
          </div>
          <span className="role-pill">{ROLE_LABEL[m.role]}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

/* ---------- Administration shortcuts (President only) ---------- */
export function ShortcutRow({ role }: { role: Role }) {
  if (role !== "president") return null;
  const items = ["Members", "Departments", "Media Bank", "Evaluations", "Activity", "Settings"];
  return (
    <div className="shortcut-row">
      {items.map((label) => (
        <span className="shortcut" key={label}>
          {label}
          <small>soon</small>
        </span>
      ))}
    </div>
  );
}
