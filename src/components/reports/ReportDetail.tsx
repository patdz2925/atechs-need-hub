"use client";

/* ============================================================
   /hub/reports/[id] — report detail + review.
   Shows the PROJECT → TASK → REPORT chain, the full content,
   review state, and the actions each viewer is allowed:
     reporter : edit own draft/returned, (re)submit, delete own draft
     reviewer : start review, approve, return (notes required)
     president: everything above, anywhere
   Approved reports are terminal — read-only for everyone.
   ============================================================ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import type { Task } from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import {
  REPORT_STATUS_LABEL,
  canDeleteReport,
  canEditReportContent,
  canReviewReport,
  canSubmitReport,
  isReporterState,
  isReviewState,
  type Report,
} from "@/lib/reports/types";
import {
  approveReport,
  deleteReport,
  returnReport,
  startReview,
  submitReport,
} from "@/lib/reports/mutations";
import type { Role } from "@/lib/roles";
import { ReportStatusPill } from "./ReportBits";
import ReportForm from "./ReportForm";

interface ReportDetailProps {
  role: Role;
  viewerId: string;
  viewerDeptId: string | null;
  report: Report;
  tasks: Task[];
  projects: Project[];
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReportDetail({
  role,
  viewerId,
  viewerDeptId,
  report,
  tasks,
  projects,
}: ReportDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const editable = canEditReportContent(role, viewerId, report);
  const submittable = canSubmitReport(role, viewerId, report);
  const reviewable =
    canReviewReport(role, viewerDeptId, report) && isReviewState(report.status);
  const deletable = canDeleteReport(role, viewerId, report);
  const isReporter = report.reporterId === viewerId;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setNotes("");
    router.refresh();
    after?.();
  }

  return (
    <>
      <Link href="/hub/reports" className="pj-back">
        <ChevronLeft size={14} aria-hidden="true" />
        All reports
      </Link>

      <Reveal direction="up" distance={24}>
        <header className="panel pj-detail-head">
          <div className="pj-title-row">
            <div>
              <div className="pj-pills">
                <ReportStatusPill status={report.status} />
              </div>
              <h1>{report.title}</h1>
              {/* PROJECT → TASK → REPORT chain */}
              <p className="pj-detail-sub rp-chain">
                <Link href={`/hub/projects/${report.projectId}`}>
                  {report.projectTitle || "Project"}
                </Link>
                <span aria-hidden="true"> → </span>
                <Link href={`/hub/tasks/${report.taskId}`}>
                  {report.taskTitle || "Task"}
                </Link>
                <span aria-hidden="true"> → </span>
                <span>Report</span>
              </p>
            </div>

            <div className="pj-actions">
              {editable && !editing && (
                <button type="button" className="pj-btn" onClick={() => setEditing(true)}>
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
              )}
              {submittable && !editing && (
                <button
                  type="button"
                  className="pj-btn pj-btn--primary"
                  disabled={busy}
                  onClick={() =>
                    void run(() => submitReport(report.id))
                  }
                >
                  {report.status === "returned" ? "Resubmit" : "Submit"}
                </button>
              )}
              {deletable && !editing && !confirmingDelete && (
                <button
                  type="button"
                  className="pj-btn pj-btn--danger"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              )}
              {deletable && !editing && confirmingDelete && (
                <span className="pj-confirm">
                  <span className="pj-confirm-label">Delete this report permanently?</span>
                  <button
                    type="button"
                    className="pj-btn pj-btn--danger"
                    disabled={busy}
                    onClick={() =>
                      void run(() => deleteReport(report.id), () =>
                        router.push("/hub/reports")
                      )
                    }
                  >
                    {busy ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    className="pj-btn"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="pj-facts">
            <div className="pj-fact">
              <div className="k">Reporter</div>
              <div className="v">{report.reporterName || "—"}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Status</div>
              <div className="v">{REPORT_STATUS_LABEL[report.status]}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Submitted</div>
              <div className="v">{fmt(report.submittedAt)}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Reviewer</div>
              <div className="v">{report.reviewerName || "—"}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Reviewed</div>
              <div className="v">{fmt(report.reviewedAt)}</div>
            </div>
            <div className="pj-fact">
              <div className="k">Updated</div>
              <div className="v">{fmt(report.updatedAt)}</div>
            </div>
          </div>
        </header>
      </Reveal>

      {error && (
        <p className="pj-err" role="alert">
          {error}
        </p>
      )}

      <div className="tk-detail" key={editing ? "editing" : "view"}>
        {editing ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Edit report</h2>
                <span className="panel-hint">
                  {isReporterState(report.status)
                    ? "Drafts and returned reports stay editable"
                    : "President correction"}
                </span>
              </div>
            </div>
            <ReportForm
              mode="edit"
              viewerId={viewerId}
              role={role}
              tasks={tasks}
              projects={projects}
              initial={report}
              onSaved={() => {
                setEditing(false);
                router.refresh();
              }}
              onCancel={() => setEditing(false)}
            />
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Summary</h2>
                </div>
              </div>
              <p className="pj-about">{report.summary || "No summary yet."}</p>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Details / accomplishments</h2>
                </div>
              </div>
              <p className="pj-about rp-pre">{report.details || "No details yet."}</p>
            </section>

            {report.blockers && (
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Blockers / issues</h2>
                  </div>
                </div>
                <p className="pj-about rp-pre">{report.blockers}</p>
              </section>
            )}

            {(report.reviewNotes || report.reviewerName) && (
              <section className="panel rp-review">
                <div className="panel-head">
                  <div>
                    <h2>Review</h2>
                    <span className="panel-hint">
                      {report.reviewerName
                        ? `By ${report.reviewerName}${report.reviewedAt ? ` · ${fmt(report.reviewedAt)}` : ""}`
                        : "Awaiting reviewer"}
                    </span>
                  </div>
                </div>
                <p className="pj-about rp-pre">
                  {report.reviewNotes || "No review notes yet."}
                </p>
              </section>
            )}

            {reviewable && (
              <section className="panel rp-review-actions">
                <div className="panel-head">
                  <div>
                    <h2>Review this report</h2>
                    <span className="panel-hint">
                      {report.status === "submitted"
                        ? "Start the review, or decide right away"
                        : "Decide on the report"}
                    </span>
                  </div>
                </div>
                {report.status === "submitted" && (
                  <button
                    type="button"
                    className="pj-btn"
                    disabled={busy}
                    onClick={() => void run(() => startReview(report.id, viewerId))}
                  >
                    Start review
                  </button>
                )}
                <div className="field" style={{ marginTop: "0.9rem" }}>
                  <label htmlFor="rp-review-notes">
                    Review notes (required when returning)
                  </label>
                  <textarea
                    id="rp-review-notes"
                    rows={3}
                    maxLength={2000}
                    placeholder="What was good, what must change…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="pj-form-actions">
                  <button
                    type="button"
                    className="pj-btn pj-btn--primary"
                    disabled={busy}
                    onClick={() => void run(() => approveReport(report.id, viewerId, notes))}
                  >
                    {busy ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="pj-btn pj-btn--danger"
                    disabled={busy}
                    onClick={() => void run(() => returnReport(report.id, viewerId, notes))}
                  >
                    {busy ? "Working…" : "Return for rework"}
                  </button>
                </div>
                <p className="pj-note">
                  Approved reports become read-only. Returned reports go back to the
                  reporter with your notes.
                </p>
              </section>
            )}

            {!reviewable && isReporterState(report.status) && !isReporter && (
              <p className="pj-note">Only the reporter can edit or submit this report.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
