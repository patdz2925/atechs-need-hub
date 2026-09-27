import { notFound, redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getDepartments, getMemberDirectory, getProjects } from "@/lib/projects/queries";
import { getFlatFolders, getMediaItem, getMediaSiblings } from "@/lib/media/queries";
import MediaDetail from "@/components/media/MediaDetail";

interface Params {
  params: { id: string };
}

export async function generateMetadata({ params }: Params) {
  const { item } = await getMediaItem(params.id);
  return {
    title: item ? `${item.title} — ATecHS Hub` : "Media — ATecHS Hub",
  };
}

/* Media detail — real Supabase record; unknown id (or invisible
   under RLS) → 404. Uploader name resolves via the directory. */
export default async function MediaDetailPage({ params }: Params) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const [{ item, error }, directory, projRes, deptRes, folderRes] = await Promise.all([
    getMediaItem(params.id),
    getMemberDirectory(),
    getProjects(),
    getDepartments(),
    getFlatFolders(),
  ]);

  if (error) throw new Error(error); // → hub/media/error.tsx boundary
  if (!item) notFound();

  const uploaderName =
    directory.find((d) => d.id === item.uploadedBy)?.name ?? "Unknown member";
  const named = { ...item, uploaderName };
  const { items: siblings } = await getMediaSiblings(named);

  return (
    <MediaDetail
      role={hub.profile.role}
      viewerId={hub.profile.id}
      viewerDeptId={hub.profile.department_id}
      item={named}
      projects={projRes.projects}
      departments={deptRes}
      folders={folderRes.folders}
      siblings={siblings}
    />
  );
}
