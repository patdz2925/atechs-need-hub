import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireHubUser } from "@/lib/auth";
import { projectActions } from "@/lib/projects/types";
import { getDepartments, getMemberDirectory } from "@/lib/projects/queries";
import PermissionDenied from "@/components/projects/PermissionDenied";
import ProjectForm from "@/components/projects/ProjectForm";

export const metadata = {
  title: "New project — ATecHS Hub",
};

/* Create flow — president only (UI gate; RLS insert policy enforces it too). */
export default async function NewProjectPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const actions = projectActions(hub.profile.role);
  if (!actions.create) return <PermissionDenied action="create projects" />;

  const [directory, departments] = await Promise.all([
    getMemberDirectory(),
    getDepartments(),
  ]);

  return (
    <>
      <div className="pj-head">
        <div>
          <Link href="/hub/projects" className="pj-back pj-back--head">
            <ChevronLeft size={14} aria-hidden="true" /> All projects
          </Link>
          <h1>New project</h1>
          <p className="pj-head-sub">Plan it, assign departments and members, then set it moving.</p>
        </div>
      </div>

      <ProjectForm
        mode="create"
        role={hub.profile.role}
        viewerId={hub.profile.id}
        initial={null}
        directory={directory}
        departments={departments}
      />
    </>
  );
}
