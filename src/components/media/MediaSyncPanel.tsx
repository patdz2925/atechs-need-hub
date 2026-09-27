"use client";

/* ============================================================
   Media Bank sync administration (president only — the page
   gates rendering; the API + RLS enforce it too).
   Sources hold Drive roots + credentials. Secrets are never
   rendered: the status API strips them, and this panel only
   ever SENDS credentials on create.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  createMediaSource,
  deleteMediaSource,
  setMediaSourceEnabled,
} from "@/lib/media/mutations";

interface StrippedSource {
  id: string;
  name: string;
  drive_folder_id: string;
  hasApiKey: boolean;
  hasServiceAccount: boolean;
  enabled: boolean;
  last_synced_at: string | null;
  last_status: string | null;
  last_stats: Record<string, number> | null;
  last_error: string | null;
  updated_at: string;
}

interface SyncOutcome {
  status: string;
  stats?: Record<string, number>;
  error?: string | null;
}

function fmtDate(value: string | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
}

export default function MediaSyncPanel() {
  const router = useRouter();
  const [sources, setSources] = useState<StrippedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add-source form state (never re-rendered back out).
  const [name, setName] = useState("");
  const [rootId, setRootId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saJson, setSaJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/media/sync", { cache: "no-store" });
      const body = (await res.json()) as unknown as {
        ok: boolean;
        sources?: StrippedSource[];
        error?: string;
      };
      if (!body.ok) throw new Error(body.error ?? "Could not load sync status.");
      setSources(body.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sync status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSync(id: string) {
    if (syncingId) return;
    setSyncingId(id);
    setOutcome(null);
    setError("");
    try {
      const res = await fetch("/api/media/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      const body = (await res.json()) as unknown as SyncOutcome & { ok: boolean };
      setOutcome(body);
      await load();
      router.refresh();
    } catch (e) {
      setOutcome({ status: "error", error: e instanceof Error ? e.message : "Sync failed." });
    } finally {
      setSyncingId(null);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    const res = await createMediaSource({
      name,
      driveFolderId: rootId,
      apiKey,
      serviceAccountJson: saJson,
    });
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error ?? "Could not save the source.");
      return;
    }
    setName("");
    setRootId("");
    setApiKey("");
    setSaJson("");
    setShowAdd(false);
    await load();
  }

  return (
    <section className="panel mb-admin" aria-label="Drive sync administration">
      <div className="panel-head">
        <div>
          <h2>Drive sync</h2>
          <span className="panel-hint">President only · Hub indexes, Drive stores</span>
        </div>
        <button type="button" className="pj-btn" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "New source"}
        </button>
      </div>

      {loading ? (
        <p className="empty">Checking Drive connection…</p>
      ) : error ? (
        <p className="pj-err" role="alert">
          {error}
        </p>
      ) : sources.length === 0 ? (
        <div className="mb-sync-empty">
          <p>
            <strong>Google Drive connection required.</strong> No sync source is configured yet —
            register your root Drive folder below. Nothing will be faked: until a source exists
            and a sync runs, the Bank only holds manually registered links.
          </p>
        </div>
      ) : (
        <div className="mb-sources">
          {sources.map((s) => (
            <article key={s.id} className="mb-source">
              <div className="mb-source-head">
                <div>
                  <strong>{s.name}</strong>
                  <span className="mb-source-root" title={s.drive_folder_id}>
                    root {shortId(s.drive_folder_id)}
                  </span>
                </div>
                <span className={`rp-st ${s.last_status === "ok" ? "rp-st--approved" : s.last_status ? "rp-st--returned" : ""}`}>
                  {!s.enabled ? "Disabled" : (s.last_status ?? "Never synced")}
                </span>
              </div>
              <div className="mb-source-meta">
                <span>
                  {s.hasServiceAccount
                    ? "Service account"
                    : s.hasApiKey
                      ? "API key"
                      : "No credentials"}
                </span>
                <span>Last sync: {fmtDate(s.last_synced_at)}</span>
                {s.last_stats && (
                  <span>
                    +{s.last_stats.filesAdded ?? 0} new · {s.last_stats.filesUpdated ?? 0} updated ·{" "}
                    {s.last_stats.archived ?? 0} archived
                  </span>
                )}
              </div>
              {s.last_error && (
                <p className="ev-err" role="alert">
                  {s.last_error}
                </p>
              )}
              {outcome && syncingId === null && (
                <p className="pj-note" aria-live="polite">
                  Last run: {outcome.status}
                  {outcome.error ? ` — ${outcome.error}` : ""}
                </p>
              )}
              <div className="pj-form-actions" style={{ marginTop: "0.6rem" }}>
                <button
                  type="button"
                  className="pj-btn pj-btn--primary"
                  disabled={syncingId !== null || !s.enabled}
                  onClick={() => void onSync(s.id)}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {syncingId === s.id ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  type="button"
                  className="pj-btn"
                  disabled={syncingId !== null}
                  onClick={() => void setMediaSourceEnabled(s.id, !s.enabled).then(() => load())}
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
                {confirmDeleteId !== s.id ? (
                  <button
                    type="button"
                    className="pj-btn pj-btn--danger"
                    disabled={syncingId !== null}
                    onClick={() => setConfirmDeleteId(s.id)}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="pj-confirm">
                    <span className="pj-confirm-label">Remove this source? Indexed rows stay.</span>
                    <button
                      type="button"
                      className="pj-btn pj-btn--danger"
                      onClick={() =>
                        void deleteMediaSource(s.id).then(() => {
                          setConfirmDeleteId(null);
                          void load();
                        })
                      }
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="pj-btn"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {showAdd && (
        <form className="mb-source-form" onSubmit={onAdd}>
          <h3>New sync source</h3>
          {formError && (
            <p className="pj-err" role="alert">
              {formError}
            </p>
          )}
          <div className="field">
            <label htmlFor="mb-src-name">Name *</label>
            <input
              id="mb-src-name"
              type="text"
              required
              maxLength={80}
              placeholder="ATecHS Society Media"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-src-root">Root Drive folder ID *</label>
            <input
              id="mb-src-root"
              type="text"
              required
              placeholder="From the folder URL: …/folders/THIS_PART"
              value={rootId}
              onChange={(e) => setRootId(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-src-key">GCP API key (public trees)</label>
            <input
              id="mb-src-key"
              type="password"
              autoComplete="off"
              placeholder="Optional — for “anyone with the link” folders"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mb-src-sa">Service-account JSON (private trees)</label>
            <textarea
              id="mb-src-sa"
              rows={3}
              autoComplete="off"
              spellCheck={false}
              placeholder='Optional — paste the whole .json key (needs Drive access to the tree)'
              value={saJson}
              onChange={(e) => setSaJson(e.target.value)}
            />
            <p className="pj-note" style={{ marginTop: "0.4rem" }}>
              Share the root folder with the service account{"'"}s email (Viewer). Keys stay
              server-side and are never shown again.
            </p>
          </div>
          <div className="pj-form-actions">
            <button className="pj-btn pj-btn--primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save source"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
