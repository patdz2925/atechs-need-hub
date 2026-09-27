/* ============================================================
    Upcoming Events — public homepage section.
    Queries real Supabase projects with stage="planned" or "upcoming"
    and public visibility.
    ============================================================ */
"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import SectionHead from "@/components/ui/SectionHead";
import Reveal from "@/components/ui/Reveal";
import { getPublicUpcomingProjects } from "@/lib/projects/queries-events";
import { formatDateRange } from "@/lib/projects/types";

/** Extract the first media URL from a comma-separated string. */
function getBannerUrl(media: string | null): string | null {
  if (!media) return null;
  const urls = media.split(",").map((u) => u.trim()).filter(Boolean);
  return urls[0] || null;
}

/** Renders the "Upcoming Events" section on the public homepage.
 *  Queries real Supabase projects with stage="planned" or "upcoming"
 *  and public visibility. */
export default function UpcomingEvents() {
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      department: string | null;
      date: string | null;
      progress: number;
      media: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUpcomingEvents() {
      try {
        const { projects: fetchedProjects, error } = await getPublicUpcomingProjects();

        if (error) {
          console.warn("[UpcomingEvents] fetch failed:", error);
          setProjects([]);
        } else {
          const eventCards = fetchedProjects.map((proj) => ({
            id: proj.id,
            title: proj.title,
            description: proj.description || "",
            department: proj.departmentNames?.[0] || null,
            date: proj.endDate || proj.startDate || null,
            progress: proj.progress,
            media: proj.media,
          }));

          setProjects(eventCards);
        }
      } catch (err) {
        console.error("[UpcomingEvents] error:", err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    loadUpcomingEvents();
  }, []);

  if (loading) {
    return <p>Loading upcoming events...</p>;
  }

  return (
    <section className="section" id="upcoming" aria-labelledby="upcoming-title">
      <div className="giant-word" aria-hidden="true">
        <span>UPCOMING</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Planned Ahead"
          title="Upcoming Events"
          titleId="upcoming-title"
          sub="Events and projects planned for the future."
        />
        <Reveal direction="up" className="section-empty">
          {projects.length > 0 ? (
            <div className="event-cards">
              {projects.map((event) => {
                const bannerUrl = getBannerUrl(event.media);
                return (
                  <Reveal key={event.id} direction="up" tilt className="card event-card">
                    {bannerUrl && (
                      <div className="event-banner">
                        <img
                          src={bannerUrl}
                          alt={event.title}
                          className="event-banner-img"
                          loading="lazy"
                        />
                      </div>
                    )}
                    {!bannerUrl && <div className="event-banner event-banner--placeholder" aria-hidden="true" />}
                    <div className="event-body">
                      <div>
                        <span className="pill pill--up" style={{ marginBottom: "0.4rem" }}>
                          <Clock size={8} aria-hidden="true" />
                          Upcoming
                        </span>
                        <h3 className="event-title">{event.title}</h3>
                      </div>
                      <p className="event-description">{event.description}</p>
                      <div className="event-meta">
                        {event.department && (
                          <>
                            <span>{event.department}</span>
                            <span className="meta-dot" aria-hidden="true" />
                          </>
                        )}
                        {event.date && (
                          <>
                            <span>{formatDateRange(event.date, null)}</span>
                          </>
                        )}
                      </div>
                      {event.progress > 0 && (
                        <div className="event-progress">
                          <div className="progress-track">
                            <span
                              className="progress-fill"
                              style={{ width: `${event.progress}%` }}
                            />
                          </div>
                          <span className="progress-pct">{event.progress}% planned</span>
                        </div>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <p className="event-empty">No upcoming events yet.</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
