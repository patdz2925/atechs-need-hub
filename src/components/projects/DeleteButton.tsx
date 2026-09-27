"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/lib/projects/mutations";

/* President-only hard delete (matrix: Archive/Delete = president,
   RLS: projects_president_delete). Two-step confirm instead of a
   native dialog. Without `redirectTo` it refreshes in place (hub
   list); with `redirectTo` it navigates there (detail page — the
   record no longer exists after its own deletion). */
export default function DeleteButton({
  projectId,
  projectTitle,
  redirectTo,
}: {
  projectId: string;
  projectTitle: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onConfirm() {
    setBusy(true);
    setError("");
    const result = await deleteProject(projectId);
    if (!result.ok) {
      setError(result.error ?? "Could not delete this project.");
      setBusy(false);
      return;
    }
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      setConfirming(false);
      setBusy(false);
      router.refresh(); // list re-fetches without the deleted row
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="pj-btn pj-btn--danger"
        onClick={() => setConfirming(true)}
      >
        <Trash2 size={14} aria-hidden="true" />
        Delete
      </button>
    );
  }

  return (
    <span className="pj-confirm">
      <span className="pj-confirm-label">
        Delete &ldquo;{projectTitle}&rdquo; permanently?
      </span>
      <button
        type="button"
        className="pj-btn pj-btn--danger"
        onClick={() => void onConfirm()}
        disabled={busy}
      >
        {busy ? "Deleting…" : "Confirm delete"}
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
