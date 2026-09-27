/* ============================================================
    Admin Events Page — President can manage projects.
    Uses project lifecycle (no separate events table).
    Displays events with banner images.
    ============================================================ */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface EventItem {
  id: string;
  title: string;
  description: string;
  stage: string;
  progress: number;
  department_id: string | null;
  start_date: string | null;
  end_date: string | null;
  media: string | null;
}

function getBannerUrl(media: string | null): string | null {
  if (!media) return null;
  const urls = media.split(",").map((u) => u.trim()).filter(Boolean);
  return urls[0] || null;
}

function formatStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    live: "Current",
    planned: "Upcoming",
    upcoming: "Upcoming",
    accomplished: "Completed",
    archived: "Archived",
  };
  return labels[stage] || stage;
}

export default function HubEventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadEvents = useCallback(async () => {
    const supa = getBrowserSupabase();
    if (!supa) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supa
        .from("projects")
        .select("id, title, description, stage, progress, department_id, start_date, end_date, media")
        .in("stage", ["live", "planned", "upcoming", "accomplished", "archived"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents((data as EventItem[]) || []);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleAdd = () => {
    setEditingEvent(null);
    setShowForm(true);
  };

  const handleEdit = (event: EventItem) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSave = async () => {
    setShowForm(false);
    setEditingEvent(null);
    await loadEvents();
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      const supa = getBrowserSupabase();
      if (supa) {
        const { error } = await supa.from("projects").delete().eq("id", id);
        if (error) throw error;
      }
      await loadEvents();
      router.refresh();
    } catch (err: any) {
      console.error("Error deleting event:", err);
      alert(err.message || "Failed to delete event");
    }
  };

  if (loading) {
    return <p>Loading events...</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Events Management</h1>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          + Add New Event
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => { setShowForm(false); setEditingEvent(null); }}
            className="text-sm text-muted-foreground hover:text-ink mb-2"
          >
            ← Back to list
          </button>
          <EventForm
            initial={
              editingEvent
                ? {
                    id: editingEvent.id,
                    title: editingEvent.title,
                    status:
                      editingEvent.stage === "live"
                        ? "current"
                        : editingEvent.stage === "accomplished"
                          ? "completed"
                          : "upcoming",
                    department: editingEvent.department_id || "",
                    date: editingEvent.start_date || "",
                    description: editingEvent.description || "",
                    progress: editingEvent.progress,
                    media: editingEvent.media ? [editingEvent.media] : [],
                  }
                : undefined
            }
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* Events List */}
      {!showForm && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events published yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => {
                const bannerUrl = getBannerUrl(event.media);
                return (
                  <div key={event.id} className="card">
                    {bannerUrl ? (
                      <div className="event-banner" style={{ height: "140px" }}>
                        <img src={bannerUrl} alt={event.title} className="event-banner-img" />
                      </div>
                    ) : (
                      <div className="event-banner event-banner--placeholder" style={{ height: "140px" }} />
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="pill pill--live">{formatStageLabel(event.stage)}</span>
                        <span className="text-xs text-muted-foreground">{event.progress}%</span>
                      </div>
                      <h3 className="font-bold">{event.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">
                          {event.department_id || "No department"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(event.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
