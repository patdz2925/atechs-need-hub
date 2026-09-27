"use client";

/* ============================================================
   Project create/edit form (president: full form incl.
   assignments · vice president: fields only — departments and
   members are read-only, matching the permission matrix where
   manage = president only).
   ============================================================ */

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProject, updateProject, type ProjectFormValues } from "@/lib/projects/mutations";
import BannerPicker, { normalizeMediaEntries } from "@/components/admin/BannerPicker";
import {
  CREATE_STATUSES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  editStatuses,
  initialsOf,
  projectActions,
  type Department,
  type DirectoryMember,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from "@/lib/projects/types";
import { ROLE_LABEL, isRole, type Role } from "@/lib/roles";

const ASSIGNMENT_ROLES = ["Member", "Lead"] as const;

interface ProjectFormProps {
  mode: "create" | "edit";
  role: Role;
  /** Profile id of the viewer (becomes projects.created_by on create). */
  viewerId: string;
  initial: Project | null;
  directory: DirectoryMember[];
  departments: Department[];
}

export default function ProjectForm({
  mode,
  role,
  viewerId,
  initial,
  directory,
  departments,
}: ProjectFormProps) {
  const router = useRouter();
  const actions = projectActions(role);
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planning");
  const [priority, setPriority] = useState<ProjectPriority>(initial?.priority ?? "normal");
  const [projectType, setProjectType] = useState(initial?.projectType ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? "");
  const [departmentIds, setDepartmentIds] = useState<string[]>(initial?.departmentIds ?? []);
  const [media, setMedia] = useState<string[]>(() =>
    normalizeMediaEntries(initial?.media ? [initial.media] : [])
  );
  const [members, setMembers] = useState<{ profileId: string; role: string }[]>(
    initial?.members.map((m) => ({ profileId: m.profileId, role: m.assignedRole })) ?? []
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = actions.manage; // assignments: president only
  const stageOptions = isEdit
    ? editStatuses(actions.archive, status)
    : CREATE_STATUSES;

  const filteredDirectory = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.department_name ?? "").toLowerCase().includes(q)
    );
  }, [directory, memberQuery]);

  const byId = useMemo(() => new Map(directory.map((d) => [d.id, d])), [directory]);

  const toggleDepartment = (id: string) =>
    setDepartmentIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleMember = (id: string) =>
    setMembers((cur) =>
      cur.some((m) => m.profileId === id)
        ? cur.filter((m) => m.profileId !== id)
        : [...cur, { profileId: id, role: "Member" }]
    );

  const setMemberRole = (id: string, roleValue: string) =>
    setMembers((cur) =>
      cur.map((m) => (m.profileId === id ? { ...m, role: roleValue } : m))
    );

  const selectedMembers = useMemo(
    () => members.map((m) => ({ ...m, member: byId.get(m.profileId) })).filter((m) => m.member),
    [members, byId]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }

    const values: ProjectFormValues = {
      title,
      description,
      status,
      priority,
      projectType,
      location,
      startDate,
      endDate,
      departmentIds,
      members,
      media: media.length ? media.join(",") : null,
    };

    setBusy(true);
    try {
      const result =
        mode === "create"
          ? await createProject(values, viewerId)
          : await updateProject(initial!.id, values, {
              manageAssignments: canManage,
              currentArchivedAt: initial?.archivedAt ?? null,
              currentCompletedAt: initial?.completedAt ?? null,
            });

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.push(isEdit ? `/hub/projects/${initial!.id}` : `/hub/projects/${result.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const backHref = isEdit ? `/hub/projects/${initial!.id}` : "/hub/projects";

  return (
    <form className="pj-form" onSubmit={onSubmit} noValidate={false}>
      {error && (
        <p className="pj-err" role="alert">
          {error}
        </p>
      )}

      {/* ---------- Details ---------- */}
      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Details</h2>
            <span className="panel-hint">What the project is</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field pj-span-2">
            <label htmlFor="pj-title">Title *</label>
            <input
              id="pj-title"
              type="text"
              required
              maxLength={140}
              placeholder="e.g. Employees' Week 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field pj-span-2">
            <label htmlFor="pj-desc">Description</label>
            <textarea
              id="pj-desc"
              rows={4}
              maxLength={2000}
              placeholder="Goals, scope, what success looks like…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ---------- Classification ---------- */}
      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Classification</h2>
            <span className="panel-hint">Stage, priority and where it happens</span>
          </div>
        </div>
        <div className="pj-form-grid">
          <div className="field">
            <label htmlFor="pj-status">Stage</label>
            <select
              id="pj-status"
              className="pj-input-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {stageOptions.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pj-priority">Priority</label>
            <select
              id="pj-priority"
              className="pj-input-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectPriority)}
            >
              {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pj-type">Project type</label>
            <input
              id="pj-type"
              type="text"
              maxLength={60}
              placeholder="Event, Outreach, Platform…"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pj-location">Location</label>
            <input
              id="pj-location"
              type="text"
              maxLength={120}
              placeholder="Main Auditorium / Online"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pj-start">Start date</label>
            <input
              id="pj-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pj-end">End date</label>
            <input
              id="pj-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ---------- Banner ---------- */}
      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Banner</h2>
            <span className="panel-hint">Card image across the hub</span>
          </div>
        </div>

        {canManage ? (
          <BannerPicker value={media} onChange={setMedia} />
        ) : (
          <p className="pj-note">Only the president can manage the banner.</p>
        )}
      </section>

      {/* ---------- Departments ---------- */}
      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Departments</h2>
            <span className="panel-hint">
              {canManage ? "All participating departments" : "View only"}
            </span>
          </div>
        </div>

        {canManage ? (
          departments.length ? (
            <div className="pj-checks">
              {departments.map((d) => {
                const on = departmentIds.includes(d.id);
                return (
                  <label className={`pj-check${on ? " is-on" : ""}`} key={d.id}>
                    <input type="checkbox" checked={on} onChange={() => toggleDepartment(d.id)} />
                    {d.name}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="empty">No departments in the directory yet.</p>
          )
        ) : departmentIds.length ? (
          <div className="pj-tags">
            {departmentIds.map((id) => (
              <span className="pj-tag" key={id}>
                {departments.find((d) => d.id === id)?.name ?? "Department"}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty">No departments assigned.</p>
        )}
        {!canManage && (
          <p className="pj-note">Only the president can manage department assignments.</p>
        )}
      </section>

      {/* ---------- Members ---------- */}
      <section className="panel pj-form-panel">
        <div className="panel-head">
          <div>
            <h2>Members</h2>
            <span className="panel-hint">
              {canManage
                ? `${members.length} assigned`
                : `${initial?.members.length ?? 0} assigned · view only`}
            </span>
          </div>
        </div>

        {canManage ? (
          <>
            {directory.length > 6 && (
              <input
                className="pj-search pj-search--block"
                type="search"
                placeholder="Search members…"
                aria-label="Search members"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
              />
            )}
            {filteredDirectory.length ? (
              <div className="pj-member-picks">
                {filteredDirectory.map((m) => {
                  const selected = members.find((x) => x.profileId === m.id);
                  return (
                    <div className={`pj-member-pick${selected ? " is-on" : ""}`} key={m.id}>
                      <label className="pj-pick-label">
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={() => toggleMember(m.id)}
                        />
                        <span className="pj-member-av" aria-hidden="true">
                          {initialsOf(m.name)}
                        </span>
                        <span className="pj-pick-text">
                          <b>{m.name}</b>
                          <small>
                            {isRole(m.role) ? ROLE_LABEL[m.role] : "Member"}
                            {m.department_name ? ` · ${m.department_name}` : ""}
                          </small>
                        </span>
                      </label>
                      {selected && (
                        <select
                          className="pj-mini-select"
                          aria-label={`Assigned role for ${m.name}`}
                          value={selected.role}
                          onChange={(e) => setMemberRole(m.id, e.target.value)}
                        >
                          {ASSIGNMENT_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="empty">No members match that search.</p>
            )}
          </>
        ) : selectedMembers.length ? (
          <div className="list">
            {selectedMembers.map(({ profileId, role: assigned, member }) => (
              <div className="pj-member" key={profileId}>
                <span className="pj-member-av" aria-hidden="true">
                  {initialsOf(member!.name)}
                </span>
                <div className="pj-member-info">
                  <b>{member!.name}</b>
                  <span>
                    {isRole(member!.role) ? ROLE_LABEL[member!.role] : "Member"}
                    {member!.department_name ? ` · ${member!.department_name}` : ""}
                  </span>
                </div>
                <span className="pj-assigned">{assigned}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No members assigned yet.</p>
        )}
        {!canManage && (
          <p className="pj-note">Only the president can manage member assignments.</p>
        )}
      </section>

      <div className="pj-form-actions">
        <button className="pj-btn pj-btn--primary" type="submit" disabled={busy}>
          {busy
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create project"}
        </button>
        <Link href={backHref} className="pj-btn">
          Cancel
        </Link>
        {isEdit && !initial?.isArchived && canManage && (
          <span className="pj-form-hint">Assignments save with the project.</span>
        )}
      </div>
    </form>
  );
}
