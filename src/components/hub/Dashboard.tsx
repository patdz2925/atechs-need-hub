/* ============================================================
   Hub Dashboard — role-aware composition.
   Data arrives from the dashboard service layer (mock today,
   Supabase later); this component only decides WHAT each role
   sees, never where the data comes from.
   ============================================================ */

import Link from "next/link";
import { ROLE_LABEL, firstName, can, type Role } from "@/lib/roles";
import { BRAND_NAME, BrandLogo } from "@/components/Brand";
import type { DashboardData } from "@/lib/dashboard/data";
import { dueState } from "@/lib/tasks/types";
import {
  Panel,
  StatTiles,
  ProjectCard,
  ProgressRow,
  TaskRow,
  ReportRow,
  EventRow,
  ActivityFeed,
  MediaGrid,
  MemberRows,
  EmptyState,
  ShortcutRow,
} from "./widgets";

interface DashboardProps {
  role: Role;
  viewerName: string;
  viewerEmail: string;
  /** Server-session profile id — used to scope "my tasks". */
  viewerId: string;
  data: DashboardData;
}

export default function Dashboard({ role, viewerName, viewerEmail, viewerId, data }: DashboardProps) {
  const {
    projects,
    tasks,
    reports,
    media,
    mediaTotal,
    members,
    activity,
    currentEvents,
    upcomingEvents,
    accomplishedEvents,
    departments,
  } = data;

  /* Shared slices */
  const active = projects.filter((p) => p.status === "active");
  const upcoming = projects.filter((p) => p.status === "upcoming");
  const accomplished = projects.filter((p) => p.status === "accomplished");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const pendingReports = reports.filter(
    (r) => r.status === "submitted" || r.status === "under_review"
  );
  /* Real tasks: scoped by the server-session profile id, never by
     client-supplied identity. */
  const myTasks = tasks.filter((t) => t.assigneeId === viewerId);
  const myOpenTasks = myTasks.filter((t) => t.status !== "done");
  const overdueTasks = myOpenTasks
    .filter((t) => dueState(t) === "overdue")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const upcomingTasks = myOpenTasks
    .filter((t) => dueState(t) === "due_soon" || dueState(t) === "upcoming")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const myReports = reports.filter((r) => r.reporterId === viewerId);

  const isAdmin = role === "president";
  const newProjectBtn = can(role, "create") ? (
    <Link href="/hub/projects/new" className="panel-action">
      + New project
    </Link>
  ) : undefined;
  const approveBtn = can(role, "approve") ? (
    <Link href="/hub/reports" className="panel-action">
      Review queue
    </Link>
  ) : undefined;

  const greeting = (
    <div className="hub-greeting">
      <span className="hub-org">
        <BrandLogo />
        {BRAND_NAME}
      </span>
      <h1>Welcome back, {firstName(viewerName)}.</h1>
      <span className="role-pill">{ROLE_LABEL[role]}</span>
      <p>
        {role === "member"
          ? "What am I involved in, and what is happening in ATecHS?"
          : "What is relevant to the organization right now?"}
      </p>
    </div>
  );

  const upcomingBlock = (
    <>
      {upcoming.length ? upcoming.map((p) => <ProjectCard key={p.id} project={p} />) : null}
      {upcomingEvents.slice(0, 3).map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      {!upcoming.length && !upcomingEvents.length ? (
        <EmptyState text="Nothing scheduled yet." />
      ) : null}
    </>
  );

  const progressBlock =
    projects.length ? (
      <div className="list">{projects.map((p) => <ProgressRow key={p.id} project={p} />)}</div>
    ) : (
      <EmptyState text="No projects to track yet." />
    );

  /* ---------------- Role dashboards ---------------- */
  switch (role) {
    /* PRESIDENT — full organization overview + administration */
    case "president":
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Active Projects" },
              { value: upcoming.length, label: "Upcoming" },
              { value: accomplished.length, label: "Accomplished" },
              { value: inProgress.length, label: "Tasks In Progress" },
              { value: pendingReports.length, label: "Pending Reports" },
              { value: members.length, label: "Members" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Active Projects" hint="Organization-wide" wide action={newProjectBtn}>
              {active.length ? (
                active.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="No active projects yet." />
              )}
            </Panel>
            <Panel title="Recent Activity" hint="Latest organizational activity">
              <ActivityFeed items={activity} />
            </Panel>
            <Panel title="Upcoming Projects & Events">{upcomingBlock}</Panel>
            <Panel title="Tasks In Progress" wide>
              {inProgress.length ? (
                inProgress.map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="Nothing in progress right now." />
              )}
            </Panel>
            <Panel title="Future Tasks" hint="Planned, not started">
              {todoTasks.length ? (
                todoTasks.map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="No future tasks recorded." />
              )}
            </Panel>
            <Panel title="Pending Reports" hint="Awaiting leadership review" wide action={approveBtn}>
              {pendingReports.length ? (
                pendingReports.map((r) => <ReportRow key={r.id} report={r} showApprove />)
              ) : (
                <EmptyState text="No reports awaiting review." />
              )}
            </Panel>
            <Panel title="Department Activity" hint="Active projects per department">
              <div className="list">
                {departments.map((d) => {
                  const activeCount = projects.filter(
                    (p) => p.department === d && p.status === "active"
                  ).length;
                  const memberCount = members.filter((m) => m.department === d).length;
                  return (
                    <div className="row" key={d}>
                      <div>
                        <div className="row-title">{d}</div>
                        <div className="row-meta">{memberCount} members</div>
                      </div>
                      <span className={activeCount ? "pill pill--active" : "pill"}>
                        {activeCount} active
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Project Progress" hint="All projects">
              {progressBlock}
            </Panel>
            <Panel title="Media Bank" hint="Latest assets">
              <MediaGrid items={media.slice(0, 4)} />
            </Panel>
          </div>
          <p className="hub-section-label">Administration</p>
          <ShortcutRow role={role} />
        </>
      );

    /* VICE PRESIDENT — broad visibility, edit-ready, no approve/delete/manage */
    case "vice_president":
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Active Projects" },
              { value: upcoming.length, label: "Upcoming" },
              { value: inProgress.length, label: "Tasks In Progress" },
              { value: pendingReports.length, label: "Pending Reports" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Active Projects" wide>
              {active.length ? (
                active.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="No active projects yet." />
              )}
            </Panel>
            <Panel title="Project Progress" hint="All projects">
              {progressBlock}
            </Panel>
            <Panel title="Recent Activity">
              <ActivityFeed items={activity} />
            </Panel>
            <Panel title="Upcoming Projects & Events">{upcomingBlock}</Panel>
            <Panel title="Tasks In Progress" wide>
              {inProgress.length ? (
                inProgress.map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="Nothing in progress right now." />
              )}
            </Panel>
            <Panel title="Reports" hint="Including pending review">
              {reports.length ? (
                reports.map((r) => <ReportRow key={r.id} report={r} />)
              ) : (
                <EmptyState text="No reports yet." />
              )}
            </Panel>
          </div>
        </>
      );

    /* ADVISER — oversight: monitor, don't administer */
    case "adviser":
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Active Projects" },
              { value: upcoming.length, label: "Upcoming" },
              { value: accomplished.length, label: "Completed" },
              { value: pendingReports.length, label: "Reports to Review" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Active Projects" hint="Oversight view" wide>
              {active.length ? (
                active.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="No active projects yet." />
              )}
            </Panel>
            <Panel title="Project Progress" hint="All projects">
              {progressBlock}
            </Panel>
            <Panel title="Upcoming Activities">{upcomingBlock}</Panel>
            <Panel title="Reports" wide>
              {reports.length ? (
                reports.map((r) => <ReportRow key={r.id} report={r} />)
              ) : (
                <EmptyState text="No reports yet." />
              )}
            </Panel>
            <Panel title="Completed Projects">
              {accomplished.length ? (
                accomplished.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="Nothing completed yet." />
              )}
            </Panel>
            <Panel title="Recent Activity">
              <ActivityFeed items={activity} />
            </Panel>
            <Panel title="Media Bank">
              <MediaGrid items={media.slice(0, 4)} />
            </Panel>
          </div>
        </>
      );

    /* DEPARTMENT HEAD — department-focused */
    case "department_head":
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Department Projects" },
              { value: inProgress.length, label: "Tasks In Progress" },
              { value: members.length, label: "Assigned Members" },
              { value: reports.length, label: "Reports" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Department Projects" hint="What is happening in my department?" wide>
              {active.length ? (
                active.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="No department projects yet." />
              )}
            </Panel>
            <Panel title="Department Tasks">
              {[...inProgress, ...todoTasks].length ? (
                [...inProgress, ...todoTasks].map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="No open department tasks." />
              )}
            </Panel>
            <Panel title="Assigned Members">
              <MemberRows members={members} />
            </Panel>
            <Panel title="Project Progress">{progressBlock}</Panel>
            <Panel title="Reports">
              {reports.length ? (
                reports.map((r) => <ReportRow key={r.id} report={r} />)
              ) : (
                <EmptyState text="No reports yet." />
              )}
            </Panel>
            <Panel title="Upcoming Work">{upcomingBlock}</Panel>
          </div>
        </>
      );

    /* OFFICER — relevant operational info, no admin controls */
    case "officer":
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Active Projects" },
              { value: inProgress.length, label: "Tasks In Progress" },
              { value: reports.length, label: "Reports" },
              { value: mediaTotal, label: "Media Items" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Active Projects" hint="Relevant to operations" wide>
              {active.length ? (
                active.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="No active projects yet." />
              )}
            </Panel>
            <Panel title="Tasks" hint="In progress">
              {inProgress.length ? (
                inProgress.map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="Nothing in progress right now." />
              )}
            </Panel>
            <Panel title="Recent Activity">
              <ActivityFeed items={activity} />
            </Panel>
            <Panel title="Reports" wide>
              {reports.length ? (
                reports.map((r) => <ReportRow key={r.id} report={r} />)
              ) : (
                <EmptyState text="No reports yet." />
              )}
            </Panel>
            <Panel title="Media Bank">
              <MediaGrid items={media.slice(0, 4)} />
            </Panel>
          </div>
        </>
      );

    /* MEMBER — intentionally simple: my stuff + what's happening */
    case "member":
    default:
      return (
        <>
          {greeting}
          <StatTiles
            tiles={[
              { value: active.length, label: "Live Projects" },
              { value: upcomingEvents.length, label: "Upcoming Events" },
              { value: myOpenTasks.length, label: "My Open Tasks" },
              { value: myReports.length, label: "My Reports" },
            ]}
          />
          <div className="hub-grid">
            <Panel title="Live Projects & Events" hint="Happening in ATecHS now" wide>
              {active.map((p) => <ProjectCard key={p.id} project={p} />)}
              {currentEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
              {!active.length && !currentEvents.length ? (
                <EmptyState text="Nothing live right now." />
              ) : null}
            </Panel>
            <Panel title="Upcoming Events">
              {upcomingEvents.length ? (
                upcomingEvents.map((e) => <EventRow key={e.id} event={e} />)
              ) : (
                <EmptyState text="No upcoming events yet." />
              )}
            </Panel>
            <Panel
              title="My Assigned Tasks"
              hint="Open My Tasks for filters"
              action={
                <Link href="/hub/tasks" className="panel-action">
                  Open My Tasks
                </Link>
              }
            >
              {myOpenTasks.length ? (
                myOpenTasks
                  .slice()
                  .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                  .map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="No tasks assigned to you right now." />
              )}
            </Panel>
            <Panel title="Overdue" hint="Past due and still open">
              {overdueTasks.length ? (
                overdueTasks.map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="Nothing overdue — you're clear." />
              )}
            </Panel>
            <Panel title="Due Soon" hint="Next on your list">
              {upcomingTasks.length ? (
                upcomingTasks.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} />)
              ) : (
                <EmptyState text="No tasks due in the next two days." />
              )}
            </Panel>
            <Panel title="Accomplished Projects">
              {accomplished.length ? (
                accomplished.map((p) => <ProjectCard key={p.id} project={p} />)
              ) : (
                <EmptyState text="Nothing accomplished yet." />
              )}
            </Panel>
            <Panel title="My Reports">
              {myReports.length ? (
                myReports.map((r) => <ReportRow key={r.id} report={r} />)
              ) : (
                <EmptyState text="You haven’t submitted any reports yet." />
              )}
            </Panel>
            <Panel title="Media Bank" hint="Photos, videos, graphics, documents">
              <MediaGrid items={media} />
            </Panel>
            <Panel title="Evaluations" wide>
              <EmptyState text="Evaluations open during review weeks — submissions arrive with the Evaluations module." />
            </Panel>
          </div>
        </>
      );
  }
}
