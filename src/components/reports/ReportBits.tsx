/* ============================================================
   Reports module — shared presentational bits (no hooks, no
   data fetching): status pill + linked report row used by the
   overview, project tab, task section and dashboard-adjacent
   lists. Pure markup so server AND client components can use it.
   ============================================================ */

import Link from "next/link";
import type { ReportStatus } from "@/lib/reports/types";
import { REPORT_STATUS_LABEL } from "@/lib/reports/types";

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return (
    <span className={`rp-st rp-st--${status}`}>
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}

export interface ReportLinkItem {
  id: string;
  title: string;
  projectTitle: string;
  taskTitle: string;
  reporterName: string;
  status: ReportStatus;
  updatedAt: string;
}

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One linked row: report → detail. PROJECT → TASK → REPORT chain
 *  stays visible in the meta line. */
export function ReportLinkRow({ report }: { report: ReportLinkItem }) {
  return (
    <Link href={`/hub/reports/${report.id}`} className="rp-row">
      <span className="rp-row-main">
        <span className="rp-row-title">{report.title}</span>
        <span className="rp-row-meta">
          {report.projectTitle || "Project"} → {report.taskTitle || "Task"}
          {" · "}
          {report.reporterName || "Member"} · {shortDate(report.updatedAt)}
        </span>
      </span>
      <ReportStatusPill status={report.status} />
    </Link>
  );
}
