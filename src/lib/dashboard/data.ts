/* ============================================================
   Dashboard service layer (the seam between UI and data).

   Dashboard components call getDashboardData() only — they never
   import demo files directly.

   Now:   projects + tasks + reports = real Supabase records
          (Projects / Tasks / Reports modules)
          everything else = Supabase queries (including Events)
           until their modules ship (Media, Members…)
   Later: every slice becomes a Supabase query behind this seam.
   ============================================================ */

import type { DemoProject } from "@/data/demoProjects";
import type { ReportListItem } from "@/lib/reports/types";
import { resolveReportNames } from "@/lib/reports/types";
import { getReports } from "@/lib/reports/queries";
import { getMediaTotal, getRecentMedia } from "@/lib/media/queries";
import { gridThumbnail, type MediaTile } from "@/lib/media/types";
import { demoMembers, type DemoMember } from "@/data/demoMembers";
import { demoActivity, type DemoActivity } from "@/data/demoActivity";
import type { Task } from "@/lib/tasks/types";
import { formatDate } from "@/lib/projects/types";
import { getDepartments, getMemberDirectory, getProjects } from "@/lib/projects/queries";
import { getTasks } from "@/lib/tasks/queries";
import { getCurrentEvents, getUpcomingEvents, getAccomplishedEvents } from "@/lib/dashboard/events";

export interface DashboardData {
  departments: string[];
  projects: DemoProject[];
  /** Real Supabase tasks (Tasks module). */
  tasks: Task[];
  /** Real Supabase reports (Reports module). */
  reports: ReportListItem[];
  /** Recent Supabase media rows (Media Bank module). */
  media: MediaTile[];
  /** Total active media rows (Media Bank module). */
  mediaTotal: number;
  members: DemoMember[];
  activity: DemoActivity[];
  currentEvents: any[];
  upcomingEvents: any[];
  accomplishedEvents: any[];
}

/* Real projects → the dashboard widget shape. The dashboard has three
   buckets (active / upcoming / accomplished): planning counts as
   upcoming, archived counts as accomplished, and cancelled/on-hold
   projects stay out of the panels (they remain visible on /hub/projects). */
async function loadDashboardProjects(): Promise<{
  projects: DemoProject[];
  departments: string[];
}> {
  const [res, departments, directory] = await Promise.all([
    getProjects(),
    getDepartments(),
    getMemberDirectory(),
  ]);

  if (res.error) console.warn("[dashboard] projects unavailable:", res.error);

  const names = new Map(directory.map((d) => [d.id, d.name]));

  const projects: DemoProject[] = [];
  for (const p of res.projects) {
    const status =
      p.status === "active"
        ? "active"
        : p.status === "completed" || p.status === "archived"
          ? "accomplished"
          : p.status === "planning" || p.status === "upcoming"
            ? "upcoming"
            : null;
    if (!status) continue; // cancelled / on hold — not dashboard material

    const lead = p.members.find((m) => m.assignedRole.toLowerCase() === "lead");
    const owner =
      (lead && names.get(lead.profileId)) ||
      (p.createdBy && names.get(p.createdBy)) ||
      "ATecHS";
    const dueDate = p.endDate ?? p.startDate;

    projects.push({
      id: p.id,
      name: p.title,
      status,
      progress: p.progress,
      department: p.departmentNames[0] ?? "—",
      owner,
      due: dueDate ? formatDate(dueDate) : "No date",
      description: p.description,
    });
  }

  return { projects, departments: departments.map((d) => d.name) };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [{ projects, departments }, taskRes, eventsRes, reportRes, dirRes, mediaRes, mediaTotalRes] =
    await Promise.all([
      loadDashboardProjects(),
      getTasks(),
      getCurrentEvents(),
      getReports(),
      getMemberDirectory(),
      getRecentMedia(8),
      getMediaTotal(),
    ]);

  if (taskRes.error) console.warn("[dashboard] tasks unavailable:", taskRes.error);
  if (eventsRes.error) console.warn("[dashboard] events unavailable:", eventsRes.error);
  if (reportRes.error) console.warn("[dashboard] reports unavailable:", reportRes.error);
  if (mediaRes.error) console.warn("[dashboard] media unavailable:", mediaRes.error);
  if (mediaTotalRes.error) console.warn("[dashboard] media total unavailable:", mediaTotalRes.error);

  const { events: currentEvents = [] } = eventsRes;

  // Fetch upcoming and accomplished events in parallel
  const [upRes, accRes] = await Promise.all([
    getUpcomingEvents(),
    getAccomplishedEvents(),
  ]);

  if (upRes.error) console.warn("[dashboard] upcoming events unavailable:", upRes.error);
  if (accRes.error) console.warn("[dashboard] accomplished events unavailable:", accRes.error);

  /* Real reports → dashboard rows (names via the member directory). */
  const namedReports = resolveReportNames(reportRes.reports, dirRes);
  const reports: ReportListItem[] = namedReports.map((r) => ({
    id: r.id,
    title: r.title,
    project: r.projectTitle || "Project",
    author: r.reporterName,
    reporterId: r.reporterId,
    date: formatDate(r.submittedAt ?? r.updatedAt) || "—",
    status: r.status,
  }));

  /* Real media → dashboard tiles (project titles via the embed). */
  const media: MediaTile[] = mediaRes.items.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.mediaType,
    project: m.projectTitle || m.eventName || "Media Bank",
    date: formatDate(m.capturedAt ?? m.createdAt) || "—",
    thumb: gridThumbnail(m),
  }));

  return {
    departments,
    projects,
    tasks: taskRes.tasks,
    reports,
    media,
    mediaTotal: mediaTotalRes.total,
    members: demoMembers,
    activity: demoActivity,
    currentEvents: currentEvents || [],
    upcomingEvents: upRes.events || [],
    accomplishedEvents: accRes.events || [],
  };
}