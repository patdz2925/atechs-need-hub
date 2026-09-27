import { notFound, redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getProject, getMemberDirectory, getDepartments } from "@/lib/projects/queries";
import { getProjectTasks } from "@/lib/tasks/queries";
import { getProjectReports } from "@/lib/reports/queries";
import { getProjectFolders, getProjectMedia } from "@/lib/media/queries";
import { mediaActions } from "@/lib/media/types";
import { resolveReportNames } from "@/lib/reports/types";
import ProjectWorkspace from "@/components/projects/ProjectWorkspace";

interface Params {
  params: { id: string };
}

export async function generateMetadata({ params }: Params) {
  const { project } = await getProject(params.id);
  return {
    title: project ? `${project.title} — ATecHS Hub` : "Project — ATecHS Hub",
  };
}

/* Project workspace — real Supabase record; unknown id → 404. */
export default async function ProjectDetailPage({ params }: Params) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [{ project, error }, directory, departments, taskRes, reportRes, mediaRes, folderRes] = await Promise.all([
    getProject(params.id),
    getMemberDirectory(),
    getDepartments(),
    getProjectTasks(params.id),
    getProjectReports(params.id),
    getProjectMedia(params.id, 6),
    getProjectFolders(params.id),
  ]);

  if (error) throw new Error(error); // → projects/error.tsx boundary
  if (!project) notFound();
  if (taskRes.error) throw new Error(taskRes.error);

  return (
    <ProjectWorkspace
      role={hub.profile.role}
      viewerId={hub.profile.id}
      project={project}
      directory={directory}
      departments={departments}
      tasks={taskRes.tasks}
      reports={resolveReportNames(reportRes.reports, directory)}
      media={mediaRes.items}
      projectFolders={folderRes.folders}
      canCreateMedia={mediaActions(hub.profile.role).create}
    />
  );
}
