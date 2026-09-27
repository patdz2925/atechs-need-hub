"use client";

/* ============================================================
   Task detail → Reports section.
   Shows reports filed on this task with entry points to read
   each one and to file a new report (assignee or editors — the
   form + RLS enforce the assignment rule).
   ============================================================ */

import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { can, type Role } from "@/lib/roles";
import type { Task } from "@/lib/tasks/types";
import type { Report } from "@/lib/reports/types";
import { ReportLinkRow } from "./ReportBits";

interface TaskReportsProps {
  role: Role;
  viewerId: string;
  task: Task;
  reports: Report[];
}

export default function TaskReports({ role, viewerId, task, reports }: TaskReportsProps) {
  const mayFile = task.assigneeId === viewerId || can(role, "edit");

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Reports</h2>
          <span className="panel-hint">
            {reports.length
              ? `${reports.length} filed on this task`
              : "What was accomplished on this task"}
          </span>
        </div>
        {mayFile && (
          <Link
            href={`/hub/reports/new?task=${task.id}`}
            className="pj-btn pj-btn--primary"
          >
            <Plus size={14} aria-hidden="true" />
            New report
          </Link>
        )}
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
          <h3>No reports on this task yet</h3>
          <p>
            {mayFile
              ? "File the first report to record what was accomplished."
              : "Reports appear here once the assignee files them."}
          </p>
        </div>
      )}
    </section>
  );
}
