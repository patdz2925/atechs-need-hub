import Link from "next/link";

/* Hub-styled empty state for the reports segment root. */
export default function ReportsNotFound() {
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
      <h1>No reports here</h1>
      <p>There&rsquo;s nothing at this address yet.</p>
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
