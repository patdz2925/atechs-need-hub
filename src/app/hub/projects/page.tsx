import { redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getDepartments, getMemberDirectory, getProjects } from "@/lib/projects/queries";
import ProjectsView from "@/components/projects/ProjectsView";

export const metadata = {
  title: "Projects — ATecHS Hub",
};

/* Projects list — real Supabase data (RLS: authenticated read, archive included). */
export default async function ProjectsPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [res, directory, departments] = await Promise.all([
    getProjects(),
    getMemberDirectory(),
    getDepartments(),
  ]);

  return (
    <ProjectsView
      role={hub.profile.role}
      projects={res.projects}
      directory={directory}
      departments={departments}
      loadError={res.error}
    />
  );
}
