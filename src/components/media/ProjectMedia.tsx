"use client";

/* ============================================================
   Project workspace → Media tab pane.
   Recent rows for the project with counts, a view-all shortcut
   (prefiltered archive) and a register shortcut for contributors.
   ============================================================ */

import Link from "next/link";
import { ImagePlus, Images } from "lucide-react";
import type { MediaItem } from "@/lib/media/types";
import type { FolderCardData } from "@/lib/media/queries";
import { MediaCard } from "./MediaBits";
import { FolderCard } from "./FolderExplorer";

interface ProjectMediaProps {
  projectId: string;
  items: MediaItem[];
  folders: FolderCardData[];
  canCreate: boolean;
  canMapProject: boolean;
  projects: Array<{ id: string; title: string }>;
  proxyFirst?: boolean;
}

export default function ProjectMedia({
  projectId,
  items,
  folders,
  canCreate,
  canMapProject,
  projects,
  proxyFirst = false,
}: ProjectMediaProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Media</h2>
          <span className="panel-hint">
            {items.length ? "Latest files on this project" : "Photos, videos and files"}
          </span>
        </div>
        <div className="pj-head-actions">
          <Link href={`/hub/media?project=${projectId}`} className="pj-btn">
            <Images size={14} aria-hidden="true" />
            View all
          </Link>
          {canCreate && (
            <Link href="/hub/media/new" className="pj-btn pj-btn--primary">
              <ImagePlus size={14} aria-hidden="true" />
              Add media
            </Link>
          )}
        </div>
      </div>

      {folders.length > 0 && (
        <div className="mb-folders mb-folders--compact" style={{ marginBottom: "1rem" }}>
          {folders.map((f) => (
            <FolderCard
              key={f.id}
              folder={f}
              canMapProject={canMapProject}
              projects={projects}
            />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-grid mb-grid--compact">
          {items.map((m) => (
            <MediaCard key={m.id} item={m} proxyFirst={proxyFirst} />
          ))}
        </div>
      )}

      {items.length === 0 && folders.length === 0 && (
        <div className="pj-empty pj-empty--tight">
          <span className="pj-empty-icon" aria-hidden="true">
            <Images size={24} />
          </span>
          <h3>No media on this project yet</h3>
          <p>Register the first Drive file or folder to start its archive.</p>
        </div>
      )}
      {items.length === 0 && folders.length > 0 && (
        <p className="pj-note">Browse the folders above — no loose files yet.</p>
      )}
    </section>
  );
}
