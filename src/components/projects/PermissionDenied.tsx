import Link from "next/link";

/* Shared "you can't open this page" state (route-level permission gate).
   Mirrors the PERMISSIONS matrix — RLS enforces the same rule server-side. */
export default function PermissionDenied({ action }: { action: string }) {
  return (
    <div className="pj-denied panel" role="alert">
      <span className="pj-empty-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <h1>Not allowed</h1>
      <p>
        Your role doesn&rsquo;t include permission to {action}. The database enforces the same
        rule through Row Level Security, so this page stays closed regardless of the link.
      </p>
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
