"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/ui/SectionHead";

const RATINGS = ["Excellent", "Good", "Average", "Needs work"] as const;

const POINTS = [
  { title: "Event quality", text: "Help us understand what resonates with the community." },
  { title: "Future planning", text: "Your suggestions guide the calendar for upcoming programs." },
  { title: "Community growth", text: "Better experiences build a stronger, more engaged society." },
];

export default function Evaluation() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="section" id="evaluation" aria-labelledby="eval-title">
      <div className="giant-word" aria-hidden="true">
        <span>FEEDBACK</span>
      </div>
      <div className="container">
        <SectionHead
          eyebrow="Have Your Say"
          title="Share Your Experience"
          titleId="eval-title"
          sub="Member evaluations help every future event get better. No account needed yet."
        />

        <div className="eval-grid">
          <Reveal direction="left" className="eval-panel">
            <div className="eval-head">
              <div className="feature-icon" style={{ margin: 0 }}>
                <MessageSquare size={24} />
              </div>
              <div>
                <h3>Evaluation Form</h3>
                <p>Preview — member submissions open soon</p>
              </div>
            </div>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div className="field">
                <span className="field-label" id="ratingLabel">
                  Overall experience
                </span>
                <div className="rating-row" role="radiogroup" aria-labelledby="ratingLabel">
                  {RATINGS.map((r) => (
                    <label key={r}>
                      <input type="radio" name="rating" value={r.toLowerCase()} />
                      <span className="rating-pill">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="wentWell">What went well</label>
                <textarea id="wentWell" name="wentWell" rows={2} placeholder="Share what you enjoyed..." />
              </div>
              <div className="field">
                <label htmlFor="improve">What could improve</label>
                <textarea id="improve" name="improve" rows={2} placeholder="Help us get better..." />
              </div>
              <div className="field">
                <label htmlFor="suggest">Suggestions</label>
                <textarea id="suggest" name="suggest" rows={2} placeholder="Your ideas matter..." />
              </div>
              <div className="field">
                <label htmlFor="evalName">
                  Name <span style={{ color: "var(--ink-faint)" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  id="evalName"
                  name="evalName"
                  placeholder="How should we credit you?"
                  autoComplete="name"
                />
              </div>
              <button className="btn btn-primary eval-submit" type="submit">
                Submit Evaluation <Send size={16} />
              </button>
              {submitted && (
                <p className="eval-notice" role="status" tabIndex={-1}>
                  Thanks — this preview does not send data yet. Member submissions open in a
                  later phase.
                </p>
              )}
            </form>
          </Reveal>

          <Reveal direction="right" delay={200} className="eval-panel">
            <h3 className="lead">Why your feedback matters</h3>
            <p className="lead-sub">
              ATecHS Society is built by its members. Every evaluation shapes the next event —
              what we keep, what we fix, and what we try next.
            </p>
            <div className="eval-points">
              {POINTS.map((pt) => (
                <div className="eval-point" key={pt.title}>
                  <span className="tick">
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <h4>{pt.title}</h4>
                    <p>{pt.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
