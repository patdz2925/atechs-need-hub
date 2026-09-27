import Link from "next/link";

/* Hub-styled 404 for an unknown report id. */
export default function ReportNotFound() {
  return (
    <div className="pj-denied panel" role="status">
      <span className="pj-empty-icon" aria-hidden="true">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 10h6" />
          <path d="M9 14h4" />
        </svg>
      </span>
      <h1>Report not found</h1>
      <p>This report doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
      <div className="pj-actions">
        <Link href="/hub/reports" className="pj-btn pj-btn--primary">
          All reports
        </Link>
        <Link href="/hub" className="pj-btn">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
