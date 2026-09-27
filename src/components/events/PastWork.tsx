/* ============================================================
    Past Work / History — public homepage section.
    Shows accomplished projects AND archived projects (archiving
    auto-routes a project here; only a hard delete removes it).
    ============================================================ */
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import SectionHead from "@/components/ui/SectionHead";
import Reveal from "@/components/ui/Reveal";
import { getPublicCompletedProjects } from "@/lib/projects/queries-events";
import { formatDateRange } from "@/lib/projects/types";

/** Extract the first media URL from a comma-separated string. */
function getBannerUrl(media: string | null): string | null {
  if (!media) return null;
  const urls = media.split(",").map((u) => u.trim()).filter(Boolean);
  return urls[0] || null;
}

/** Renders the "Past Work" / "History" section on the public homepage.
 *  Shows accomplished AND archived projects with public visibility. */
export default function PastWork() {
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      department: string | null;
      date: string | null;
      progress: number;
      media: string | null;
      isArchived: boolean;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPastWork() {
      try {
        const { projects: fetchedProjects, error } = await getPublicCompletedProjects();

        if (error) {
          console.warn("[PastWork] fetch failed:", error);
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
            isArchived: proj.isArchived,
          }));

          setProjects(eventCards);
        }
      } catch (err) {
        console.error("[PastWork] error:", err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    loadPastWork();
  }, []);

  if (loading) {
    return <p>Loading past work...</p>;
  }

  return (
    <section className="section" id="accomplished" aria-labelledby="accomplished-title">
      <div className="giant-word" aria-hidden="true">
        <span>HISTORY</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Completed"
          title="Past Work"
          titleId="accomplished-title"
          sub="Completed events and finished projects."
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
                        <span className="pill pill--live" style={{ marginBottom: "0.4rem" }}>
                          <CheckCircle2 size={8} aria-hidden="true" />
                          {event.isArchived ? "Archived" : "Completed"}
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
                    </div>
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <p className="event-empty">No completed events yet.</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
