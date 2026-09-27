"use client";

import Link from "next/link";
import { useEffect } from "react";

/* Error boundary for the media segment (bank + nested routes). */
export default function MediaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[media]", error);
  }, [error]);

  return (
    <div className="pj-denied panel" role="alert">
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
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </span>
      <h1>Something went wrong</h1>
      <p>{error.message || "Media couldn't be loaded right now."}</p>
      <div className="pj-actions">
        <button type="button" className="pj-btn pj-btn--primary" onClick={reset}>
          Try again
        </button>
        <Link href="/hub" className="pj-btn">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
