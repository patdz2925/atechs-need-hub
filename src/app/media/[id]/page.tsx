import { notFound } from "next/navigation";
import Navigation from "@/components/navigation/Navigation";
import { getMediaItem, getMediaSiblings } from "@/lib/media/queries";
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

/* Public media detail — NO auth. Every query runs anonymous, so RLS
   returns exactly the public rows; anything else 404s like missing.
   Rendered with member-level props but zero identity: no edit form,
   no manage panel, no names (directory unresolvable anonymously). */
export default async function PublicMediaDetailPage({ params }: Params) {
  const [{ item, error }] = await Promise.all([getMediaItem(params.id)]);

  if (error || !item) notFound();

  const named = { ...item, uploaderName: "" };
  const { items: siblings } = await getMediaSiblings(named);

  return (
    <>
      <Navigation />
      <main className="container" id="content" style={{ paddingTop: "5.5rem" }}>
      <MediaDetail
        role="member"
        viewerId=""
        viewerDeptId={null}
        item={named}
        projects={[]}
        departments={[]}
        folders={[]}
        siblings={siblings}
        basePath="/media"
      />
      </main>
    </>
  );
}
