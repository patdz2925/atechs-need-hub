/* ============================================================
    Event Form — admin only (President role).
    Creates/edits/deletes events backed by the `projects` table.
    Banner image comes from the `media` field (comma-separated URLs).
    First URL = banner; no URL = gradient placeholder.
   Banner can be drag-and-dropped (uploaded to the `project-banners`
   storage bucket — run supabase/storage-banners.sql once) or pasted
   as a URL.
    ============================================================ */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";
import BannerPicker, { normalizeMediaEntries } from "./BannerPicker";

interface EventFormProps {
  initial?: {
    id?: string;
    title: string;
    status: "current" | "upcoming" | "completed";
    department: string;
    date: string;
    description: string;
    progress?: number;
    tags?: string[];
    media?: string[];
  };
  onSave?: () => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function EventForm({ initial, onSave, onDelete }: EventFormProps = {}) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: initial?.id || "",
    title: initial?.title || "",
    status: initial?.status || "upcoming",
    department: initial?.department || "",
    date: initial?.date || "",
    description: initial?.description || "",
    progress: initial?.progress ?? 0,
    tags: initial?.tags || [],
    media: normalizeMediaEntries(initial?.media || []),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!!initial?.id);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        tags: prev.tags.includes(value)
          ? prev.tags.filter((t) => t !== value)
          : [...prev.tags, value],
      }));
    } else if (name === "tags") {
      const tags = value.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      setForm((prev) => ({ ...prev, tags }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const upsertProject = async (data: Record<string, unknown>): Promise<void> => {
    const supa = getBrowserSupabase();
    if (!supa) throw new Error("Supabase isn't configured.");

    if (data.id) {
      const { error } = await supa.from("projects").update(data).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supa.from("projects").insert(data).select().single();
      if (error) throw error;
    }
  };

  const deleteProject = async (id: string): Promise<void> => {
    const supa = getBrowserSupabase();
    if (!supa) throw new Error("Supabase isn't configured.");
    const { error } = await supa.from("projects").delete().eq("id", id);
    if (error) throw error;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const projectData: Record<string, unknown> = {
        title: form.title,
        stage: form.status === "current" ? "live" : form.status === "upcoming" ? "planned" : "accomplished",
        department_id: form.department || null,
        start_date: form.date || null,
        end_date: form.date || null,
        description: form.description || null,
        progress: form.progress,
        media: form.media.length > 0 ? form.media.join(",") : null,
        project_type: "event",
      };

      if (isEditing && form.id) {
        projectData.id = form.id;
      }

      await upsertProject(projectData);
      router.refresh();
      if (onSave) await onSave();
    } catch (err: any) {
      console.error("Error saving event:", err);
      setError(err.message || "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id || !confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteProject(form.id);
      router.refresh();
      if (onDelete) await onDelete(form.id);
    } catch (err: any) {
      console.error("Error deleting event:", err);
      setError(err.message || "Failed to delete event");
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto p-6 space-y-4">
      <h2 className="text-2xl font-bold">
        {isEditing ? "Edit Event" : "Add New Event"}
      </h2>

      <p className="text-sm text-muted-foreground mt-2">
        {isEditing ? "Modify an existing event" : "Create a new event for the dashboard"}
      </p>

      {/* Banner picker — drag-and-drop upload, browse, or paste a URL.
          First media entry becomes the card banner. */}
      <BannerPicker
        value={form.media}
        onChange={(media) => setForm((prev) => ({ ...prev, media }))}
      />

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="current">Current (Live)</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Progress</label>
            <input
              type="number"
              name="progress"
              value={form.progress}
              onChange={handleChange}
              min={0}
              max={100}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Department</label>
          <input
            type="text"
            name="department"
            value={form.department}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        ></textarea>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <input
            type="text"
            name="tags"
            value={form.tags.join(",")}
            onChange={handleChange}
            placeholder="Ceremony, Awards, Community"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">Comma-separated list</p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : isEditing ? "Update Event" : "Save Event"}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} className="inline mr-1" /> Delete
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsEditing(false)}
          disabled={submitting}
          className="flex-1 px-4 py-2 bg-secondary text-white font-medium rounded-md hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
