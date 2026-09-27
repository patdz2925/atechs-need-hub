import { notFound, redirect } from "next/navigation";
import { requireHubUser } from "@/lib/auth";
import { getDepartments, getProjects } from "@/lib/projects/queries";
import { getChildFolders, getFolderPath, getMediaFolder, getMediaPage, searchMediaFolders } from "@/lib/media/queries";
import {
  DEFAULT_MEDIA_FILTERS,
  MEDIA_PAGE_SIZE,
  type MediaFilters,
} from "@/lib/media/types";
import { mediaActions } from "@/lib/media/types";
import MediaGrid from "@/components/media/MediaGrid";
import FolderExplorer from "@/components/media/FolderExplorer";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Media Bank — ATecHS Hub",
};

interface MediaPageProps {
  searchParams?: {
    q?: string;
    type?: string;
    project?: string;
    department?: string;
    tag?: string;
    featured?: string;
    sort?: string;
    folder?: string;
  };
}

/* Media Bank — folder explorer + server-paginated archive + (president)
   Drive sync administration. Browsing always queries the Supabase
   index; Drive is touched only by sync and the thumbnail proxy. */
export default async function MediaBankPage({ searchParams }: MediaPageProps) {
  const hub = await requireHubUser();
  if (!hub) redirect("/login");

  const isPresident = hub.profile.role === "president";

  // Query params arrive as string | string[] | undefined — first wins.
  const first = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? (v[0] ?? "") : (v ?? "");

  // Folder context (?folder=): invisible/unknown ids 404 like records.
  const folderId = first(searchParams?.folder).trim() || null;
  let folder: { id: string; name: string } | null = null;
  let folderPath: Array<{ id: string; name: string }> = [];
  if (folderId) {
    const res = await getMediaFolder(folderId);
    if (res.error) throw new Error(res.error);
    if (!res.folder) notFound();
    folder = { id: res.folder.id, name: res.folder.name };
    const pathRes = await getFolderPath(folderId);
    if (pathRes.error) throw new Error(pathRes.error);
    folderPath = pathRes.path;
  }

  const q = first(searchParams?.q);
  const typeParam = first(searchParams?.type);
  const projectParam = first(searchParams?.project);
  const departmentParam = first(searchParams?.department);
  const tagParam = first(searchParams?.tag);
  const sortParam = first(searchParams?.sort);

  const initialFilters: MediaFilters = {
    ...DEFAULT_MEDIA_FILTERS,
    query: q,
    type:
      typeParam === "image" ||
      typeParam === "video" ||
      typeParam === "document" ||
      typeParam === "other"
        ? typeParam
        : "all",
    projectId: projectParam || "all",
    departmentId: departmentParam || "all",
    folderId: folderId ?? "all",
    tag: tagParam,
    featured: first(searchParams?.featured) === "1",
    sort:
      sortParam === "newest" ||
      sortParam === "oldest" ||
      sortParam === "title" ||
      sortParam === "recently_added"
        ? sortParam
        : DEFAULT_MEDIA_FILTERS.sort,
  };

  const [page, projRes, deptRes, childrenRes, folderSearchRes] = await Promise.all([
    getMediaPage(initialFilters, 1, MEDIA_PAGE_SIZE),
    getProjects(),
    getDepartments(),
    getChildFolders(folderId),
    initialFilters.query.trim()
      ? searchMediaFolders(initialFilters.query.trim())
      : Promise.resolve({ folders: [], error: null as string | null }),
  ]);
  if (childrenRes.error) throw new Error(childrenRes.error);

  const actions = mediaActions(hub.profile.role);
  const projectOptions = projRes.projects.map((p) => ({ id: p.id, title: p.title }));

  return (
    <>
      <div className="pj-head">
        <div>
          <h1>Media Bank</h1>
          <p className="pj-head-sub">Find photos, videos, and school media in one place.</p>
        </div>
        <div className="pj-head-actions">
          {isPresident && (
            <Link href="/hub/media/sync" className="pj-btn">
              <RefreshCw size={14} aria-hidden="true" />
              Drive sync
            </Link>
          )}
          {actions.create && (
            <Link href="/hub/media/new" className="pj-btn pj-btn--primary">
              <Plus size={14} aria-hidden="true" />
              Register media
            </Link>
          )}
        </div>
      </div>

      <FolderExplorer
        current={folder}
        path={folderPath}
        folders={childrenRes.folders}
        canMapProject={isPresident}
        projects={projectOptions}
      />

      {folderSearchRes.folders.length > 0 && (
        <section aria-label="Matching folders" className="mb-explorer">
          <p className="mb-section-kicker">Folders matching “{initialFilters.query.trim()}”</p>
          <div className="mb-folders">
            {folderSearchRes.folders.map((f) => (
              <Link key={f.id} href={`/hub/media?folder=${f.id}`} className="mb-folder-card">
                <span className="mb-folder-name">{f.name}</span>
                {f.projectTitle && <span className="mb-folder-project">{f.projectTitle}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <MediaGrid
        initialItems={page.items}
        initialTotal={page.total}
        pageSize={MEDIA_PAGE_SIZE}
        initialFilters={initialFilters}
        projects={projRes.projects}
        departments={deptRes}
        canCreate={actions.create}
        proxyThumbs={isPresident}
        loadError={page.error}
      />
      <p className="pj-note" style={{ marginTop: "1.5rem" }}>
        The Hub organizes — originals stay in Google Drive. Open any item for its Drive link.
      </p>
    </>
  );
}
