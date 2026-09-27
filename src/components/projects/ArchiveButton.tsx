"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { archiveProject } from "@/lib/projects/mutations";

/* President-only archive action (matrix: Archive/Delete = president).
   Two-step confirm instead of a native dialog; no hard delete anywhere. */
export default function ArchiveButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onConfirm() {
    setBusy(true);
    setError("");
    const result = await archiveProject(projectId);
    if (!result.ok) {
      setError(result.error ?? "Could not archive this project.");
      setBusy(false);
      return;
    }
    setConfirming(false);
    setBusy(false);
    router.refresh(); // stay on the page — the archived banner appears
  }

  if (!confirming) {
    return (
      <button type="button" className="pj-btn" onClick={() => setConfirming(true)}>
        <Archive size={14} aria-hidden="true" />
        Archive
      </button>
    );
  }

  return (
    <span className="pj-confirm">
      <span className="pj-confirm-label">Archive this project?</span>
      <button
        type="button"
        className="pj-btn pj-btn--confirm"
        onClick={() => void onConfirm()}
        disabled={busy}
      >
        {busy ? "Archiving…" : "Confirm archive"}
      </button>
      <button
        type="button"
        className="pj-btn"
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        Cancel
      </button>
      {error && (
        <span className="pj-confirm-err" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
