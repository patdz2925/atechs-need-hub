import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireHubUser } from "@/lib/auth";
import { projectActions } from "@/lib/projects/types";
import { getProject, getDepartments, getMemberDirectory } from "@/lib/projects/queries";
import PermissionDenied from "@/components/projects/PermissionDenied";
import ProjectForm from "@/components/projects/ProjectForm";

export const metadata = {
  title: "Edit project — ATecHS Hub",
};

/* Edit flow — president + vice president (UI gate; RLS update policy enforces). */
export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const actions = projectActions(hub.profile.role);
  if (!actions.edit) return <PermissionDenied action="edit projects" />;

  const [{ project, error }, directory, departments] = await Promise.all([
    getProject(params.id),
    getMemberDirectory(),
    getDepartments(),
  ]);

  if (error) throw new Error(error); // → projects/error.tsx boundary
  if (!project) notFound();

  return (
    <>
      <div className="pj-head">
        <div>
          <Link href={`/hub/projects/${project.id}`} className="pj-back pj-back--head">
            <ChevronLeft size={14} aria-hidden="true" /> Back to project
          </Link>
          <h1>Edit project</h1>
          <p className="pj-head-sub">{project.title}</p>
        </div>
      </div>

      <ProjectForm
        mode="edit"
        role={hub.profile.role}
        viewerId={hub.profile.id}
        initial={project}
        directory={directory}
        departments={departments}
      />
    </>
  );
}
