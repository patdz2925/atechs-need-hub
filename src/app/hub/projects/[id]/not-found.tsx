import Link from "next/link";

/* Hub-styled 404 for an unknown project id. */
export default function ProjectNotFound() {
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
          <path d="M3 7h5l2 2h11v10a2 2 0 0 1-2 2H3z" />
          <path d="M3 7V5a2 2 0 0 1 2-2h3" />
        </svg>
      </span>
      <h1>Project not found</h1>
      <p>This project doesn&rsquo;t exist, or the link is no longer valid.</p>
      <div className="pj-actions">
        <Link href="/hub/projects" className="pj-btn pj-btn--primary">
          Back to projects
        </Link>
        <Link href="/hub" className="pj-btn">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
