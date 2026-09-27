"use client";

/* ============================================================
   Media register/edit form.
   Registers an EXISTING Google Drive file/folder (no uploads —
   Drive stays the storage layer). The Drive input accepts a full
   share URL or a bare file id; folder-only rows are allowed so a
   Drive folder can be indexed before per-file import exists.
   Create navigates to the new record; edit works inline with an
   optional parent callback — same contract as ReportForm.
   ============================================================ */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMedia, updateMedia } from "@/lib/media/mutations";
import {
  MEDIA_TYPE_LABEL,
  MEDIA_VISIBILITIES,
  MEDIA_VISIBILITY_LABEL,
  isDriveUrl,
  type MediaFolder,
  type MediaItem,
  type MediaType,
  type MediaVisibility,
} from "@/lib/media/types";
import type { Department, Project } from "@/lib/projects/types";

interface MediaFormProps {
  mode: "create" | "edit";
  viewerId: string;
  projects: Project[];
  departments: Department[];
  folders: MediaFolder[];
  initial?: MediaItem | null;
  canFeature: boolean;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

export default function MediaForm({
  mode,
  viewerId,
  projects,
  departments,
  folders,
  initial,
  canFeature,
  onSaved,
  onCancel,
}: MediaFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [mediaType, setMediaType] = useState<MediaType>(initial?.mediaType ?? "image");
  const [driveInput, setDriveInput] = useState(
    initial?.driveUrl ?? initial?.driveFileId ?? ""
  );
  const [driveFolderId, setDriveFolderId] = useState(initial?.driveFolderId ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initial?.thumbnailUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(initial?.previewUrl ?? "");
  const [projectId, setProjectId] = useState<string | null>(initial?.projectId ?? null);
  const [departmentId, setDepartmentId] = useState<string | null>(initial?.departmentId ?? null);
  const [folderId, setFolderId] = useState<string | null>(initial?.folderId ?? null);
  const [capturedAt, setCapturedAt] = useState((initial?.capturedAt ?? "").slice(0, 10));
  const [location, setLocation] = useState(initial?.location ?? "");
  const [eventName, setEventName] = useState(initial?.eventName ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [visibility, setVisibility] = useState<MediaVisibility>(
    initial?.visibility ?? "organization"
  );
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const driveHint = driveInput.trim()
    ? isDriveUrl(driveInput.trim())
      ? "Google Drive link recognized."
      : "Only Google Drive links (or bare file IDs) are accepted."
    : "Paste a Drive share link or file ID.";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setBusy(true);
    try {
      const values = {
        title,
        description,
        mediaType,
        driveInput,
        driveFolderId,
        thumbnailUrl,
        previewUrl,
        projectId,
        departmentId,
        folderId,
        capturedAt,
        location,
        eventName,
        tags: tags.split(","),
        visibility,
        isFeatured: canFeature && isFeatured,
      };
      if (!isEdit) {
        const res = await createMedia(values, viewerId);
        if (!res.ok || !res.id) {
          setError(res.error ?? "Could not register the media.");
          return;
        }
        router.refresh();
        if (onSaved) onSaved(res.id);
        else router.push(`/hub/media/${res.id}`);
        return;
      }
      const res = await updateMedia(initial!.id, values);
      if (!res.ok) {
        setError(res.error ?? "Could not save the media.");
        return;
      }
      router.refresh();
      if (onSaved) onSaved(initial!.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pj-form" onSubmit={onSubmit}>
      {error && (
        <p className="pj-err" role="alert">
          {error}
        </p>
      )}

      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Drive reference</h2>
            <span className="panel-hint">Where the original lives — Drive stores, Hub organizes</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field pj-span-2">
            <label htmlFor="mb-drive">Google Drive file link or file ID *</label>
            <input
              id="mb-drive"
              type="text"
              required
              placeholder="https://drive.google.com/file/d/…/view"
              value={driveInput}
              onChange={(e) => setDriveInput(e.target.value)}
            />
            <p className="pj-note" style={{ marginTop: "0.4rem" }}>{driveHint}</p>
          </div>
          <div className="field pj-span-2">
            <label htmlFor="mb-folder">Drive folder ID (optional)</label>
            <input
              id="mb-folder"
              type="text"
              placeholder="Folder containing this file — enables “Open folder”"
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Details</h2>
            <span className="panel-hint">What the archive shows</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field pj-span-2">
            <label htmlFor="mb-title">Title *</label>
            <input
              id="mb-title"
              type="text"
              required
              maxLength={140}
              placeholder="e.g. Employees Week — opening ceremony"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field pj-span-2">
            <label htmlFor="mb-desc">Description</label>
            <textarea
              id="mb-desc"
              rows={3}
              maxLength={2000}
              placeholder="What is in this file, who is in it…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-type">Type</label>
            <select
              id="mb-type"
              className="pj-input-select"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
            >
              {(Object.keys(MEDIA_TYPE_LABEL) as MediaType[]).map((t) => (
                <option key={t} value={t}>
                  {MEDIA_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mb-captured">Captured date</label>
            <input
              id="mb-captured"
              type="date"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-project">Project / event</label>
            <select
              id="mb-project"
              className="pj-input-select"
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mb-dept">Department</label>
            <select
              id="mb-dept"
              className="pj-input-select"
              value={departmentId ?? ""}
              onChange={(e) => setDepartmentId(e.target.value || null)}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="mb-folder">Hub folder</label>
            <select
              id="mb-folder"
              className="pj-input-select"
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || null)}
            >
              <option value="">No folder (archive root)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field pj-span-2">
            <label htmlFor="mb-tags">Tags (comma-separated)</label>
            <input
              id="mb-tags"
              type="text"
              placeholder="employees-week, school-event, teachers"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-location">Location</label>
            <input
              id="mb-location"
              type="text"
              maxLength={120}
              placeholder="Main Auditorium"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-event">Legacy event name</label>
            <input
              id="mb-event"
              type="text"
              maxLength={120}
              placeholder="Only for pre-Hub imports — prefer the project link"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-thumb">Thumbnail URL (optional)</label>
            <input
              id="mb-thumb"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-preview">Preview URL (optional)</label>
            <input
              id="mb-preview"
              type="url"
              inputMode="url"
              placeholder="https://… (safe video/image preview)"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Visibility</h2>
            <span className="panel-hint">Who may discover this</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field">
            <label htmlFor="mb-visibility">Visibility</label>
            <select
              id="mb-visibility"
              className="pj-input-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as MediaVisibility)}
            >
              {MEDIA_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {MEDIA_VISIBILITY_LABEL[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="pj-static-label">Access</span>
            <p className="pj-static-value" style={{ fontSize: "0.82rem", color: "var(--ink-mute)" }}>
              {visibility === "private" &&
                "Only you, the president and the vice president."}
              {visibility === "organization" &&
                "Every signed-in ATecHS Society member."}
              {visibility === "school" && "Every signed-in school user."}
              {visibility === "public" &&
                "Anyone, including signed-out guests — only for safe public content."}
              {visibility === "department" &&
                "Members of the linked department (plus leadership)."}
            </p>
          </div>
          {canFeature && (
            <div className="field pj-span-2">
              <label className="mb-check" htmlFor="mb-featured">
                <input
                  id="mb-featured"
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                Featured — surface on the homepage and dashboard
              </label>
            </div>
          )}
        </div>
      </section>

      <div className="pj-form-actions">
        <button className="pj-btn pj-btn--primary" type="submit" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Registering…") : isEdit ? "Save changes" : "Register Media"}
        </button>
        {onCancel ? (
          <button type="button" className="pj-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : (
          <Link href="/hub/media" className="pj-btn">
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
