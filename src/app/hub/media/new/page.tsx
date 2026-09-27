import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireHubUser } from "@/lib/auth";
import { getDepartments, getProjects } from "@/lib/projects/queries";
import { getFlatFolders } from "@/lib/media/queries";
import { mediaActions } from "@/lib/media/types";
import MediaForm from "@/components/media/MediaForm";

export const metadata = {
  title: "Register Media — ATecHS Hub",
};

/* Register a Drive file/folder — contributors only (UI gate;
   RLS insert policy enforces it too). */
export default async function NewMediaPage() {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  if (!mediaActions(hub.profile.role).create) {
    redirect("/hub/media");
  }

  const [projRes, deptRes, folderRes] = await Promise.all([getProjects(), getDepartments(), getFlatFolders()]);

  return (
    <>
      <div className="pj-head">
        <div>
          <Link href="/hub/media" className="pj-back pj-back--head">
            <ChevronLeft size={14} aria-hidden="true" /> Media Bank
          </Link>
          <h1>Register media</h1>
          <p className="pj-head-sub">Index an existing Google Drive file or folder.</p>
        </div>
      </div>

      <MediaForm
        mode="create"
        viewerId={hub.profile.id}
        projects={projRes.projects}
        departments={deptRes}
        folders={folderRes.folders}
        initial={null}
        canFeature={mediaActions(hub.profile.role).feature}
      />
    </>
  );
}
