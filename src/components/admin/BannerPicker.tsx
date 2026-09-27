"use client";

/* ============================================================
   BannerPicker — shared banner image picker (events admin form
   + project create/edit form). Drag-and-drop or click-to-browse
   uploads to the `project-banners` storage bucket (run
   supabase/storage-banners.sql once); pasting a hosted URL works
   without any setup. Value is a normalized URL list — the first
   entry is the card banner.
   ============================================================ */

import { useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { ImagePlus } from "lucide-react";

/** Storage bucket holding uploaded banner images (see storage-banners.sql). */
const BANNER_BUCKET = "project-banners";
/** Reject files larger than this — keeps rows + bandwidth sane. */
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

/** Split raw media entries on commas so legacy whole-string values
 *  ("url1,url2" stored as one item) still resolve to real URLs. */
export function normalizeMediaEntries(entries: string[]): string[] {
  return entries
    .flatMap((m) => m.split(","))
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

interface BannerPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export default function BannerPicker({ value, onChange }: BannerPickerProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const bannerUrl = value.length > 0 ? value[0] : null;

  const friendlyUploadError = (message: string): string => {
    const m = message.toLowerCase();
    if (m.includes("bucket not found") || m.includes("does not exist")) {
      return "Banner storage isn't set up yet — run supabase/storage-banners.sql in the Supabase SQL Editor, then retry.";
    }
    if (m.includes("row-level security") || m.includes("not authorized")) {
      return "You don't have permission to upload banners (president only).";
    }
    if (m.includes("jwt") || m.includes("token")) return "Your session expired — sign in again.";
    return message;
  };

  const uploadBanner = async (file: File): Promise<string> => {
    const supa = getBrowserSupabase();
    if (!supa) throw new Error("Supabase isn't configured.");
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "banner";
    const path = `banners/${Date.now()}-${safe}`;
    const { error } = await supa.storage.from(BANNER_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) throw error;
    const { data } = supa.storage.from(BANNER_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleBannerFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || uploading) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("That file isn't an image — choose a PNG, JPG, or WebP file.");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      setUploadError("That image is larger than 5 MB — compress it and try again.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadBanner(file);
      onChange([url, ...value.filter((u) => u !== url)]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setUploadError(friendlyUploadError(message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <span className="ev-label" id="ev-banner-label">
        <ImagePlus size={14} aria-hidden="true" />
        Banner image — drop a file here or click to browse
      </span>
      <div
        className={`ev-dropzone${dragging ? " is-dragging" : ""}${uploading ? " is-uploading" : ""}`}
        role="button"
        tabIndex={0}
        aria-labelledby="ev-banner-label"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleBannerFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void handleBannerFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {bannerUrl ? (
          <div className="event-banner" style={{ height: "140px", pointerEvents: "none" }}>
            <img src={bannerUrl} alt="Banner preview" className="event-banner-img" />
          </div>
        ) : (
          <div
            className="event-banner event-banner--placeholder"
            style={{ height: "140px", pointerEvents: "none" }}
          >
            <div className="ev-placeholder">
              <ImagePlus size={24} aria-hidden="true" /> No banner image set
            </div>
          </div>
        )}
        <p className="ev-hint">
          {uploading
            ? "Uploading banner…"
            : dragging
              ? "Drop the image to upload it"
              : "Drag & drop an image here, or click to browse (PNG/JPG/WebP, max 5 MB)"}
        </p>
      </div>
      {uploadError && (
        <p className="ev-err" role="alert">
          {uploadError}
        </p>
      )}
      {bannerUrl && !uploading && (
        <button
          type="button"
          className="ev-remove"
          onClick={() => onChange(value.slice(1))}
        >
          Remove banner
        </button>
      )}

      <label className="ev-label" htmlFor="ev-banner-url" style={{ marginTop: "0.9rem" }}>
        <ImagePlus size={14} aria-hidden="true" />
        Banner image URL (alternative to upload)
      </label>
      <input
        id="ev-banner-url"
        type="text"
        className="ev-url-input"
        value={value.join(",")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((u) => u.trim())
              .filter((u) => u.length > 0)
          )
        }
        placeholder="https://example.com/banner.jpg"
      />
      <p className="ev-sub">
        Paste a hosted image URL, or upload above. The first URL becomes the banner.
      </p>
    </div>
  );
}
