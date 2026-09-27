import Link from "next/link";

/* Hub-styled 404 for an unknown task id. */
export default function TaskNotFound() {
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
      <h1>Task not found</h1>
      <p>This task doesn&rsquo;t exist, or the link is no longer valid.</p>
      <div className="pj-actions">
        <Link href="/hub/tasks" className="pj-btn pj-btn--primary">
          My Tasks
        </Link>
        <Link href="/hub" className="pj-btn">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
