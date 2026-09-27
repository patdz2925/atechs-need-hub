-- ============================================================
-- ATecHS Hub — STAGE 2: Projects system reconciliation migration
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Afterwards, run the VERIFICATION block at the bottom and paste
-- its output back.
--
-- SAFETY CONTRACT
--   * NO DROP TABLE / no table recreation anywhere.
--   * NO row deletion or overwrite (baseline counts verified below).
--   * Additive only: ADD COLUMN IF NOT EXISTS, new enum VALUES,
--     new indexes, one new relation table, RLS policies.
--   * Existing columns reused wherever they already represent the
--     required data (mapping table below).
--   * Existing policies were inspected first (step1 §3); only the
--     two inconsistent ones are replaced — reasons inline.
--   * public.profiles is NOT modified. current_org_role() and
--     handle_new_user() are NOT modified (only called).
--
-- BASELINE (step1 §4 — must be unchanged after this run):
--   profiles=1  departments=4  projects=0  project_members=0  tasks=0
--   (project_departments is new → expected0)
--
-- SCHEMA MAPPING (spec field → actual column):
--   status          → stage (project_stage enum)      [REUSED]
--   archive flag    → archived_at (exists) + stage='archived'
--   departments     → department_id (exists, primary)
--                     + NEW project_departments (multi-participation)
--   assigned member → project_members.profile_id (exists, UUIDs)
--   slug            → intentionally SKIPPED (routes use id)
--   priority        → NEW (nothing equivalent existed)
--   project_type    → NEW   location → NEW
--   media           → NEW (banner image URLs, comma-separated; first URL = card banner)
--   updated_at      → NEW + touch trigger   completed_at → NEW
--
-- STAGE ↔ APP STATUS (adapted at the data layer, per project rules):
--   planned↔planning · upcoming↔upcoming(NEW VALUE) · live↔active
--   accomplished↔completed · archived↔archived · cancelled↔cancelled(NEW VALUE)
--   on_hold = legacy template value: kept, never written by the app.
-- ============================================================


-- ============ 1) ENUMS ============

-- 1a) project_priority (new; spec requirement, no equivalent column existed)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_priority'
  ) then
    execute 'create type public.project_priority as enum (''low'', ''normal'', ''high'', ''urgent'')';
    raise notice 'created enum public.project_priority';
  end if;
end $$;

-- 1b) project_stage: keep ALL existing values; ADD the two lifecycle
--     values the spec requires (additive only — nothing dropped/renamed)
do $$
declare v text;
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_stage'
  ) then
    raise exception 'project_stage enum not found — inspect before continuing';
  end if;

  foreach v in array array['upcoming', 'cancelled'] loop
    if not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'project_stage'
        and e.enumlabel = v
    ) then
      execute format('alter type public.project_stage add value %L', v);
      raise notice 'project_stage: added value %', v;
    end if;
  end loop;
end $$;


-- ============ 2) projects: add missing columns ============
alter table public.projects
  add column if not exists priority public.project_priority not null default 'normal',
  add column if not exists project_type text,
  add column if not exists location text,
  add column if not exists media text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz;


-- ============ 3) updated_at maintenance (app + any path) ============
create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row
  execute function public.touch_project_updated_at();


-- ============ 4) NEW relation: multi-department participation ============
create table if not exists public.project_departments (
  project_id    uuid not null references public.projects (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (project_id, department_id)
);

comment on table public.project_departments is
  'Departments participating in a project (many-to-many). projects.department_id keeps the primary/lead department.';
comment on column public.project_departments.department_id is
  'References departments(id) — same FK pattern as profiles.department_id.';


-- ============ 5) Indexes (only what the module actually needs) ============
create index if not exists project_members_profile_id_idx
  on public.project_members (profile_id);
create index if not exists project_departments_department_id_idx
  on public.project_departments (department_id);
create index if not exists projects_created_at_idx
  on public.projects (created_at desc);


-- ============ 6) RLS enabled on all three project tables ============
-- (idempotent; guarantees enforcement even if a table was created RLS-off)
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_departments enable row level security;


-- ============ 7) projects policies (canonical set) ============

-- (a) READ — the approved policy, verbatim: every authenticated user,
--     archive included, no separate archive read permission.
--     REPLACES projects_view (restricted members to live/accomplished/
--     assigned/dept-scoped), which contradicted the approved read model.
drop policy if exists "projects_view" on public.projects;
drop policy if exists "projects_authenticated_read" on public.projects;
create policy "projects_authenticated_read"
  on public.projects
  for select
  to authenticated
  using (true);

-- (b) INSERT — President only (roles.ts matrix: create=true only for
--     president). Existing projects_president_insert already matched;
--     recreated identically so the whole set is deterministic + rerunnable.
drop policy if exists "projects_president_insert" on public.projects;
create policy "projects_president_insert"
  on public.projects
  for insert
  to authenticated
  with check (current_org_role() = 'president'::org_role);

-- (c) UPDATE — matrix: edit=true only for president + vice_president.
--     REPLACES projects_edit, which also granted update rights to
--     officer and in-department department_head — neither has edit in
--     the matrix ("other roles: only permissions explicitly granted
--     by the existing role system").
drop policy if exists "projects_edit" on public.projects;
create policy "projects_edit"
  on public.projects
  for update
  to authenticated
  using (current_org_role() in ('president'::org_role, 'vice_president'::org_role))
  with check (current_org_role() in ('president'::org_role, 'vice_president'::org_role));

-- (d) DELETE — President only; the UI archives instead of deleting.
drop policy if exists "projects_president_delete" on public.projects;
create policy "projects_president_delete"
  on public.projects
  for delete
  to authenticated
  using (current_org_role() = 'president'::org_role);


-- ============ 8) project_members policies (own, considered set) ============
-- No policies existed here at all (step1 §3): with RLS on, assignments
-- would have been invisible/unwritable for everyone.

-- READ: mirrors the projects read model — assignment rows carry no
-- sensitive data (project_id, profile_id, role, joined_at); member
-- NAMES come from member_directory(), not from this table.
drop policy if exists "project_members_authenticated_read" on public.project_members;
create policy "project_members_authenticated_read"
  on public.project_members
  for select
  to authenticated
  using (true);

-- WRITE: "manage" permission → president only per the matrix.
drop policy if exists "project_members_president_manage" on public.project_members;
create policy "project_members_president_manage"
  on public.project_members
  for all
  to authenticated
  using (current_org_role() = 'president'::org_role)
  with check (current_org_role() = 'president'::org_role);


-- ============ 9) project_departments policies (mirrors above) ============
drop policy if exists "project_departments_authenticated_read" on public.project_departments;
create policy "project_departments_authenticated_read"
  on public.project_departments
  for select
  to authenticated
  using (true);

drop policy if exists "project_departments_president_manage" on public.project_departments;
create policy "project_departments_president_manage"
  on public.project_departments
  for all
  to authenticated
  using (current_org_role() = 'president'::org_role)
  with check (current_org_role() = 'president'::org_role);


-- ============ 10) Controlled member directory (assignment + display) ============
-- The ONLY way the app reads other users' identity:
--   * profiles stays SELECT-own; auth.users is never exposed.
--   * Returns strictly the fields needed: id, display name, role,
--     department (assignment stores UUIDs — profile_id — never names).
--   * Display name derives server-side (name → full_name → email
--     prefix → 'Member'); the email address itself never leaves.
--   * Inactive profiles excluded. EXECUTE revoked from anon/public.
create or replace function public.member_directory()
returns table (
  id uuid,
  name text,
  role text,
  department_id uuid,
  department_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(p.name, ''), nullif(p.full_name, ''),
             split_part(coalesce(p.email, ''), '@', 1), 'Member') as name,
    coalesce(p.role::text, 'member') as role,
    p.department_id,
    d.name as department_name
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  where coalesce(p.is_active, true)
  order by name;
$$;

revoke execute on function public.member_directory() from public;
revoke execute on function public.member_directory() from anon;
grant execute on function public.member_directory() to authenticated;


-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) Row counts (first five MUST equal the baseline; last must be 0)
select 'profiles' as tbl, count(*) from public.profiles
union all select 'departments', count(*) from public.departments
union all select 'projects', count(*) from public.projects
union all select 'project_members', count(*) from public.project_members
union all select 'project_departments', count(*) from public.project_departments
union all select 'tasks', count(*) from public.tasks
order by tbl;

-- V2) projects columns after reconciliation
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;

-- V3) Policies on the project tables (+ untouched profiles/departments)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('projects', 'project_members', 'project_departments',
                    'profiles', 'departments')
order by tablename, policyname;

-- V4) Enum values after reconciliation
select t.typname as enum_type, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('project_stage', 'project_priority')
order by t.typname, e.enumsortorder;

-- V5) Functions in play (member_directory must appear; both callable)
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('member_directory', 'current_org_role', 'handle_new_user')
order by p.proname;
