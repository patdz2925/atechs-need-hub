"use client";

/* ============================================================
   /hub/reports — reports overview with scope tabs, search,
   filters and sort. Presentational over server-fetched props;
   filtering/sorting is client-side (org-sized data), RLS already
   scoped every row server-side.
   ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { EmptyState, StatTiles } from "@/components/hub/widgets";
import { ReportLinkRow } from "./ReportBits";
import {
  REPORT_STATUS_CHIPS,
  REPORT_STATUS_LABEL,
  canReviewReport,
  filterReports,
  isReviewState,
  sortReports,
  type Report,
  type ReportScope,
  type ReportSortKey,
  type ReportStatus,
} from "@/lib/reports/types";
import type { Department, DirectoryMember, Project } from "@/lib/projects/types";
import type { Role } from "@/lib/roles";

interface ReportsViewProps {
  role: Role;
  viewerId: string;
  viewerDeptId: string | null;
  reports: Report[];
  directory: DirectoryMember[];
  departments: Department[];
  projects: Project[];
  loadError: string | null;
}

const SCOPES: Array<{ key: ReportScope; label: string }> = [
  { key: "mine", label: "My reports" },
  { key: "review", label: "Review queue" },
  { key: "all", label: "All reports" },
];

export default function ReportsView({
  role,
  viewerId,
  viewerDeptId,
  reports,
  directory,
  departments: _departments,
  projects,
  loadError,
}: ReportsViewProps) {
  const router = useRouter();

  const [scope, setScope] = useState<ReportScope>(
    role === "president" || role === "vice_president" ? "review" : "mine"
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ReportStatus>("all");
  const [projectId, setProjectId] = useState<"all" | string>("all");
  const [reporterId, setReporterId] = useState<"all" | string>("all");
  const [sort, setSort] = useState<ReportSortKey>("updated");

  const byId = useMemo(() => new Map(directory.map((d) => [d.id, d])), [directory]);

  const counts = useMemo(() => {
    const c: Record<ReportStatus, number> = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      approved: 0,
      returned: 0,
    };
    for (const r of reports) c[r.status] += 1;
    return c;
  }, [reports]);

  const scopeCounts = useMemo(
    () => ({
      mine: reports.filter((r) => r.reporterId === viewerId).length,
      review: reports.filter(
        (r) => isReviewState(r.status) && canReviewReport(role, viewerDeptId, r)
      ).length,
      all: reports.length,
    }),
    [reports, viewerId, viewerDeptId, role]
  );

  const reporterOptions = useMemo(() => {
    const ids = [...new Set(reports.map((r) => r.reporterId))];
    return ids
      .map((id) => ({ id, name: byId.get(id)?.name ?? "Unknown member" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reports, byId]);

  const visible = useMemo(
    () =>
      sortReports(
        filterReports(
          reports,
          { query, status, projectId, reporterId, sort },
          viewerId,
          scope,
          viewerDeptId,
          role
        ),
        sort
      ),
    [reports, query, status, projectId, reporterId, sort, viewerId, scope, viewerDeptId, role]
  );

  const hasFilters =
    query.trim() !== "" || status !== "all" || projectId !== "all" || reporterId !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setProjectId("all");
    setReporterId("all");
  };

  if (loadError) {
    return (
      <>
        <div className="pj-head">
          <div>
            <h1>Reports</h1>
            <p className="pj-head-sub">Plan → Assign → Work → Report → Review</p>
          </div>
        </div>
        <div className="pj-alert" role="alert">
          <span>
            Couldn&rsquo;t load reports: <strong>{loadError}</strong>
          </span>
          <button type="button" className="pj-btn" onClick={() => router.refresh()}>
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pj-head">
        <div>
          <h1>Reports</h1>
          <p className="pj-head-sub">Plan → Assign → Work → Report → Review</p>
        </div>
        <div className="pj-head-actions">
          <Link href="/hub/reports/new" className="pj-btn pj-btn--primary">
            <Plus size={14} aria-hidden="true" />
            New report
          </Link>
        </div>
      </div>

      <StatTiles
        tiles={[
          { value: reports.length, label: "Total reports" },
          { value: counts.draft, label: "Draft" },
          { value: counts.submitted, label: "Submitted" },
          { value: counts.under_review, label: "Under review" },
          { value: counts.approved, label: "Approved" },
          { value: counts.returned, label: "Returned" },
        ]}
      />

      {reports.length === 0 ? (
        <div className="pj-empty">
          <span className="pj-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </span>
          <h3>No reports yet</h3>
          <p>File your first report on a task assigned to you to record completed work.</p>
          <Link href="/hub/reports/new" className="pj-btn pj-btn--primary">
            <Plus size={14} aria-hidden="true" />
            Create report
          </Link>
        </div>
      ) : (
        <>
          <div className="pj-chips" role="tablist" aria-label="Report scope">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={scope === s.key}
                className={`pj-chip${scope === s.key ? " is-active" : ""}`}
                onClick={() => setScope(s.key)}
              >
                {s.label}
                <span className="pj-chip-count">{scopeCounts[s.key]}</span>
              </button>
            ))}
          </div>

          <div className="pj-toolbar">
            <input
              className="pj-search"
              type="search"
              placeholder="Search by title or summary…"
              aria-label="Search reports"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="pj-select"
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | ReportStatus)}
            >
              {REPORT_STATUS_CHIPS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.key === "all" ? "Any status" : REPORT_STATUS_LABEL[c.key]}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Filter by project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="all">Any project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Filter by reporter"
              value={reporterId}
              onChange={(e) => setReporterId(e.target.value)}
            >
              <option value="all">Any reporter</option>
              {reporterOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              className="pj-select"
              aria-label="Sort reports"
              value={sort}
              onChange={(e) => setSort(e.target.value as ReportSortKey)}
            >
              <option value="updated">Recently updated</option>
              <option value="submitted">Recently submitted</option>
              <option value="created">Recently created</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>

          <p className="pj-count">
            Showing {visible.length} of {reports.length}{" "}
            {reports.length === 1 ? "report" : "reports"}
            {hasFilters && (
              <button type="button" className="pj-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          {visible.length ? (
            <div className="rp-list">
              {visible.map((r, i) => (
                <Reveal key={r.id} direction="up" distance={16} delay={Math.min(i, 8) * 50}>
                  <ReportLinkRow report={r} />
                </Reveal>
              ))}
            </div>
          ) : scope === "mine" && !hasFilters ? (
            <EmptyState text="No reports yet." />
          ) : scope === "review" && !hasFilters ? (
            <EmptyState text="No reports are waiting for review." />
          ) : (
            <div className="pj-empty pj-empty--filtered">
              <span className="pj-empty-icon" aria-hidden="true">
                <ClipboardList size={24} />
              </span>
              <h3>No matching reports</h3>
              <p>Nothing here matches the current scope, search or filters.</p>
              <button type="button" className="pj-btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
