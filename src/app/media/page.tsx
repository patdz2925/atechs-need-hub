import Link from "next/link";
import { notFound } from "next/navigation";
import Navigation from "@/components/navigation/Navigation";
import { getChildFolders, getFolderPath, getMediaFolder, getMediaPage, searchMediaFolders } from "@/lib/media/queries";
import {
  DEFAULT_MEDIA_FILTERS,
  MEDIA_PAGE_SIZE,
  type MediaFilters,
} from "@/lib/media/types";
import MediaGrid from "@/components/media/MediaGrid";
import FolderExplorer from "@/components/media/FolderExplorer";

export const metadata = {
  title: "Media Bank — ATecHS Hub",
};

interface PublicMediaPageProps {
  searchParams?: {
    q?: string;
    type?: string;
    tag?: string;
    sort?: string;
    folder?: string;
  };
}

/* Public archive — NO auth. Every query below runs anonymous, so
   RLS returns exactly the public rows (visibility = public,
   active). No emails, no names, no manage actions reach this page:
   grids render with create/proxy disabled and empty option lists. */
export default async function PublicMediaPage({ searchParams }: PublicMediaPageProps) {
  const first = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

  const folderId = first(searchParams?.folder).trim() || null;
  let folder: { id: string; name: string } | null = null;
  let folderPath: Array<{ id: string; name: string }> = [];
  if (folderId) {
    const res = await getMediaFolder(folderId);
    if (!res.folder) notFound();
    folder = { id: res.folder.id, name: res.folder.name };
    folderPath = (await getFolderPath(folderId)).path;
  }

  const typeParam = first(searchParams?.type);
  const sortParam = first(searchParams?.sort);
  const initialFilters: MediaFilters = {
    ...DEFAULT_MEDIA_FILTERS,
    query: first(searchParams?.q),
    type:
      typeParam === "image" || typeParam === "video" || typeParam === "document" || typeParam === "other"
        ? typeParam
        : "all",
    folderId: folderId ?? "all",
    tag: first(searchParams?.tag),
    sort:
      sortParam === "newest" ||
      sortParam === "oldest" ||
      sortParam === "title" ||
      sortParam === "recently_added"
        ? sortParam
        : DEFAULT_MEDIA_FILTERS.sort,
  };

  const [page, childrenRes, folderSearchRes] = await Promise.all([
    getMediaPage(initialFilters, 1, MEDIA_PAGE_SIZE),
    getChildFolders(folderId),
    initialFilters.query.trim()
      ? searchMediaFolders(initialFilters.query.trim())
      : Promise.resolve({ folders: [], error: null as string | null }),
  ]);

  // Guests must never see schema internals: an unmigrated database
  // simply reads as an empty public archive (nothing visible either).
  const schemaMissing =
    !!page.error &&
    /out of date|does not exist|schema cache/i.test(page.error);

  return (
    <>
      <Navigation />
      <main className="container" id="content" style={{ paddingTop: "5.5rem" }}>
      <div className="pj-head">
        <div>
          <h1>Media Bank</h1>
          <p className="pj-head-sub">Public school archive — open media, no sign-in needed.</p>
        </div>
        <div className="pj-head-actions">
          <Link href="/login" className="pj-btn">
            Sign in for the full archive
          </Link>
        </div>
      </div>

      <FolderExplorer
        current={folder}
        path={folderPath}
        folders={childrenRes.folders}
        canMapProject={false}
        projects={[]}
        basePath="/media"
      />

      {folderSearchRes.folders.length > 0 && (
        <section aria-label="Matching folders" className="mb-explorer">
          <p className="mb-section-kicker">Folders matching “{initialFilters.query.trim()}”</p>
          <div className="mb-folders">
            {folderSearchRes.folders.map((f) => (
              <Link key={f.id} href={`/media?folder=${f.id}`} className="mb-folder-card">
                <span className="mb-folder-name">{f.name}</span>
                {f.projectTitle && <span className="mb-folder-project">{f.projectTitle}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <MediaGrid
        initialItems={schemaMissing ? [] : page.items}
        initialTotal={schemaMissing ? 0 : page.total}
        pageSize={MEDIA_PAGE_SIZE}
        initialFilters={initialFilters}
        projects={[]}
        departments={[]}
        canCreate={false}
        loadError={schemaMissing ? null : page.error}
        basePath="/media"
      />
      </main>
    </>
  );
}
