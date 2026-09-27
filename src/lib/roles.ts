/* ============================================================
   ATecHS Hub — Roles & global permission model
   Single source of truth for role-based access in the client.
   NOTE: these are UI-level checks only. Real enforcement happens
   with Supabase Row Level Security (see supabase/profiles.sql).
   ============================================================ */

export type Role =
  | "president"
  | "vice_president"
  | "officer"
  | "adviser"
  | "department_head"
  | "member";

export const DEFAULT_ROLE: Role = "member";

export const ROLE_LABEL: Record<Role, string> = {
  president: "President",
  vice_president: "Vice President",
  officer: "Officer",
  adviser: "Adviser",
  department_head: "Department Head",
  member: "Member",
};

export type Action = "create" | "edit" | "delete" | "approve" | "manage";

/** Global permissions (from the ATecHS permission model). */
export const PERMISSIONS: Record<Role, Record<Action, boolean>> = {
  /*             create  edit  delete  approve  manage */
  president:     { create: true,  edit: true,  delete: true,  approve: true,  manage: true },
  vice_president:{ create: false, edit: true,  delete: false, approve: false, manage: false },
  officer:       { create: false, edit: false, delete: false, approve: false, manage: false },
  adviser:       { create: false, edit: false, delete: false, approve: false, manage: false },
  department_head:{ create: false, edit: false, delete: false, approve: false, manage: false },
  member:        { create: false, edit: false, delete: false, approve: false, manage: false },
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.[action] ?? false;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLE_LABEL;
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}
