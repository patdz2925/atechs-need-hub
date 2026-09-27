"use client";

/* ============================================================
   Media Bank folder explorer: breadcrumbs, folder cards with
   thumbnail collage covers, and (president-only) project
   mapping. Navigation is plain links (?folder=) so every level
   is shareable and server-rendered.
   ============================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, FolderOpen, Home } from "lucide-react";
import { setFolderProject } from "@/lib/media/mutations";
import { MEDIA_VISIBILITIES, MEDIA_VISIBILITY_LABEL, type MediaVisibility } from "@/lib/media/types";
import type { FolderCardData } from "@/lib/media/queries";

export interface ExplorerCrumb {
  id: string;
  name: string;
}

/** 2×2 cover collage from indexed thumbnails (no new image files —
 *  each tile falls back away silently when its source 404s). */
export function FolderCover({ covers, name }: { covers: string[]; name: string }) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const visible = covers.filter((_, i) => !hidden.has(i)).slice(0, 4);
  if (!visible.length) {
    return (
      <div className="mb-folder-cover mb-folder-cover--empty" aria-hidden="true">
        <FolderOpen size={36} />
      </div>
    );
  }
  return (
    <div className="mb-folder-cover" aria-hidden="true">
      {visible.map((src, i) => (
        <img
          key={`${i}-${src.slice(-24)}`}
          src={src}
          alt=""
          loading="lazy"
          onError={() =>
            setHidden((cur) => {
              const next = new Set(cur);
              // Hide by original index — covers order is stable here.
              const idx = covers.indexOf(src);
              if (idx >= 0) next.add(idx);
              return next;
            })
          }
        />
      ))}
    </div>
  );
}

interface FolderCardProps {
  folder: FolderCardData;
  /** President-only project mapping UI. */
  canMapProject: boolean;
  projects: Array<{ id: string; title: string }>;
  basePath?: string;
}

export function FolderCard({ folder, canMapProject, projects, basePath = "/hub/media" }: FolderCardProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(folder.projectId ?? "");
  const [visibility, setVisibility] = useState<MediaVisibility>(folder.visibility);
  // Cascade is opt-in: aligning a whole subtree rewrites many rows,
  // so it must always be a deliberate check, never a default.
  const [cascade, setCascade] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const projectDirty = (projectId || "") !== (folder.projectId ?? "");
  const visibilityDirty = visibility !== folder.visibility;
  // The cascade checkbox is itself an intent: applying the CURRENT
  // visibility to the subtree must be savable even when nothing else
  // changed (otherwise cascade-only saves are unclickable).
  const saveEnabled = !saving && (projectDirty || visibilityDirty || cascade);

  // Server props are the source of truth: after save + refresh, snap
  // local edits back so the card never shows a stale selection.
  useEffect(() => {
    setProjectId(folder.projectId ?? "");
    setVisibility(folder.visibility);
    setSaved("");
    setError("");
  }, [folder.projectId, folder.visibility]);

  async function onSave() {
    if (!saveEnabled) return;
    setSaving(true);
    setError("");
    setSaved("");
    if (projectDirty) {
      const res = await setFolderProject(folder.id, projectId || null);
      if (!res.ok) {
        setSaving(false);
        setError(res.error ?? "Could not map the folder.");
        return;
      }
    }
    if (visibilityDirty || cascade) {
      try {
        const res = await fetch("/api/media/folders/visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId: folder.id,
            visibility,
            applyToContents: cascade,
          }),
        });
        const body = (await res.json()) as unknown as {
          ok: boolean;
          error?: string;
          updatedMedia?: number;
          updatedFolders?: number;
        };
        if (!body.ok) {
          setSaving(false);
          setError(body.error ?? "Could not save visibility.");
          return;
        }
        if (cascade) {
          const f = body.updatedFolders ?? 0;
          const m = body.updatedMedia ?? 0;
          setSaved(`Saved — applied to ${f} ${f === 1 ? "folder" : "folders"}, ${m} ${m === 1 ? "item" : "items"}`);
        } else {
          setSaved("Saved");
        }
      } catch (e) {
        setSaving(false);
        setError(e instanceof Error ? e.message : "Could not save visibility.");
        return;
      }
    } else {
      setSaved("Saved");
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="mb-folder-card">
      <Link href={`${basePath}?folder=${folder.id}`} className="mb-folder-link">
        <FolderCover covers={folder.covers} name={folder.name} />
        <span className="mb-folder-name">{folder.name}</span>
        <span className="mb-folder-meta">
          {folder.mediaCount} {folder.mediaCount === 1 ? "item" : "items"}
          {folder.childCount > 0 &&
            ` · ${folder.childCount} ${folder.childCount === 1 ? "folder" : "folders"}`}
        </span>
        <span className="mb-folder-tags">
          {folder.projectTitle && <span className="mb-folder-project">{folder.projectTitle}</span>}
          <span className={`mb-vis mb-vis--${folder.visibility}`}>
            {MEDIA_VISIBILITY_LABEL[folder.visibility]}
          </span>
        </span>
      </Link>
      {canMapProject && (
        <div className="mb-folder-map">
          <select
            aria-label={`Map ${folder.name} to a project`}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setSaved("");
            }}
            disabled={saving}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <select
            aria-label={`Visibility of ${folder.name} (private hides it from everyone except leadership)`}
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as MediaVisibility);
              setSaved("");
            }}
            disabled={saving}
          >
            {MEDIA_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {MEDIA_VISIBILITY_LABEL[v]}
              </option>
            ))}
          </select>
          <label className="mb-check" title="Apply the visibility to every item in this folder tree (overwrites their own setting)">
            <input
              type="checkbox"
              checked={cascade}
              onChange={(e) => setCascade(e.target.checked)}
              disabled={saving}
            />
            Contents too
          </label>
          <button
            type="button"
            className="pj-btn"
            disabled={!saveEnabled}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : saved || "Save"}
          </button>
          {error && (
            <span className="ev-err" role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface FolderExplorerProps {
  /** Null = archive root. */
  current: { id: string; name: string } | null;
  path: ExplorerCrumb[];
  folders: FolderCardData[];
  canMapProject: boolean;
  projects: Array<{ id: string; title: string }>;
  basePath?: string;
}

export default function FolderExplorer({
  current,
  path,
  folders,
  canMapProject,
  projects,
  basePath = "/hub/media",
}: FolderExplorerProps) {
  return (
    <section aria-label="Folder explorer" className="mb-explorer">
      <nav className="mb-crumbs" aria-label="Breadcrumb">
        <Link href={basePath} className="mb-crumb">
          <Home size={13} aria-hidden="true" />
          Media Bank
        </Link>
        {path.map((c) => (
          <span key={c.id} className="mb-crumb-sep">
            <ChevronRight size={13} aria-hidden="true" />
            {current && c.id === current.id ? (
              <span className="mb-crumb current" aria-current="page">
                {c.name}
              </span>
            ) : (
              <Link href={`${basePath}?folder=${c.id}`} className="mb-crumb">
                {c.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {folders.length > 0 && (
        <div className="mb-folders">
          {folders.map((f) => (
            <FolderCard key={f.id} folder={f} canMapProject={canMapProject} projects={projects} basePath={basePath} />
          ))}
        </div>
      )}
    </section>
  );
}
