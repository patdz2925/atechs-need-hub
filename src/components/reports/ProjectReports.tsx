"use client";

/* ============================================================
   Project workspace → Reports tab pane.
   Lists the project's reports (RLS-filtered server-side) with a
   shortcut into the full Reports overview. Overview untouched.
   ============================================================ */

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { Report } from "@/lib/reports/types";
import { ReportLinkRow } from "./ReportBits";

interface ProjectReportsProps {
  reports: Report[];
}

export default function ProjectReports({ reports }: ProjectReportsProps) {
  const done = reports.filter((r) => r.status === "approved").length;
  const pending = reports.filter(
    (r) => r.status === "submitted" || r.status === "under_review"
  ).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Reports</h2>
          <span className="panel-hint">
            {reports.length
              ? `${done} approved · ${pending} awaiting review`
              : "Work reported on this project's tasks"}
          </span>
        </div>
        <Link href="/hub/reports" className="pj-btn">
          All reports
        </Link>
      </div>

      {reports.length ? (
        <div className="rp-list">
          {reports.map((r) => (
            <ReportLinkRow key={r.id} report={r} />
          ))}
        </div>
      ) : (
        <div className="pj-empty pj-empty--tight">
          <span className="pj-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <h3>No reports in this project yet</h3>
          <p>Reports appear here once members file them on the project&apos;s tasks.</p>
        </div>
      )}
    </section>
  );
}
