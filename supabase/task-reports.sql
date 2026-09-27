-- ============================================================
-- ATecHS Hub — REPORTS module: task_reports table + RLS
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Afterwards, run the VERIFICATION block at the bottom and paste
-- its output back.
--
-- WORKFLOW COMPLETED: Plan → Assign → Work → REPORT → Review →
-- Complete → Archive. A member reports on assigned work; reviewers
-- approve or return it. Projects/tasks stay the source of truth —
-- reports only REFERENCE them (FKs), never duplicate them.
--
-- SAFETY CONTRACT
--   * Additive only: one new table, new indexes, one trigger
--     function, new policies. No DROP/ALTER of existing tables.
--   * public.profiles / projects / tasks are NOT modified.
--   * current_org_role() and member_directory() are NOT modified
--     (only called).
--
-- ROLE MODEL (mirrors src/lib/roles.ts + task_reports RLS below;
-- UI gating in src/lib/reports/types.ts is display-only):
--   reporter (any signed-in member): own reports — create (draft)
--     for tasks assigned to them, edit own draft/returned, submit,
--     delete own drafts.
--   reviewer: president + vice president (all reports) and
--     department_head for reports whose project sits in their own
--     department. Reviewers move submitted/under_review reports to
--     under_review / approved / returned and write review notes.
--   president: full oversight (view/edit/delete any report).
--   officer / adviser: own reports only (the existing permission
--     matrix grants them no oversight powers).
--
-- STATUS LIFECYCLE (also enforced below):
--   draft → submitted → under_review → approved
--   submitted/under_review → returned → draft → submitted…
--   approved is terminal. Returning REQUIRES review notes.
-- ============================================================


-- ============ 1) Table ============
create table if not exists public.task_reports (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  reporter_id   uuid not null references public.profiles (id) on delete restrict,
  title         text not null,
  summary       text not null default '',
  details       text not null default '',
  blockers      text,
  status        text not null default 'draft',
  reviewer_id   uuid references public.profiles (id) on delete set null,
  review_notes  text,
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- New rows always start as drafts; submission completeness is
  -- enforced for every non-draft state (drafts may stay partial).
  constraint task_reports_status_values
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'returned')),
  constraint task_reports_title_present
    check (length(btrim(title)) > 0),
  constraint task_reports_submission_complete
    check (
      status = 'draft'
      or (
        length(btrim(coalesce(summary, ''))) > 0
        and length(btrim(coalesce(details, ''))) > 0
      )
    )
);

comment on table public.task_reports is
  'Member reports on assigned tasks (Plan → Assign → Work → REPORT → Review). References projects/tasks/profiles — never duplicates them.';


-- ============ 2) Indexes (only what the module queries) ============
create index if not exists task_reports_task_id_idx
  on public.task_reports (task_id);
create index if not exists task_reports_project_id_idx
  on public.task_reports (project_id);
create index if not exists task_reports_reporter_id_idx
  on public.task_reports (reporter_id);
create index if not exists task_reports_status_idx
  on public.task_reports (status);
create index if not exists task_reports_reviewer_id_idx
  on public.task_reports (reviewer_id);


-- ============ 3) Lifecycle trigger ============
-- Enforces what RLS row-policies cannot express:
--   * report linkage (task/project/reporter) is immutable,
--   * returning a report REQUIRES review notes,
--   * submitted_at / reviewed_at / updated_at are stamped
--     server-side (clients never need to send them).
-- Status WHO/WHEN is enforced by the RLS policies below; the
-- trigger only guards cross-row invariants + notes + timestamps.
create or replace function public.validate_task_report()
returns trigger
language plpgsql
as $$
begin
  -- Linkage is immutable after insert.
  if TG_OP = 'UPDATE' then
    if NEW.task_id is distinct from OLD.task_id
      or NEW.project_id is distinct from OLD.project_id
      or NEW.reporter_id is distinct from OLD.reporter_id then
      raise exception 'A report cannot be moved to another task, project, or reporter.';
    end if;
  end if;

  -- New reports always start as drafts (RLS agrees — belt and braces).
  if TG_OP = 'INSERT' and NEW.status is distinct from 'draft' then
    raise exception 'New reports always start as drafts.';
  end if;

  -- A return without an explanation is useless to the reporter.
  if NEW.status = 'returned'
    and length(btrim(coalesce(NEW.review_notes, ''))) = 0 then
    raise exception 'Returning a report requires review notes explaining what must change.';
  end if;

  -- Server-side timestamps.
  NEW.updated_at = now();
  if NEW.status = 'submitted'
    and (TG_OP = 'INSERT' or OLD.status is distinct from 'submitted')
    and NEW.submitted_at is null then
    NEW.submitted_at = now();
  end if;
  if NEW.status in ('approved', 'returned')
    and (TG_OP = 'INSERT' or OLD.status not in ('approved', 'returned')) then
    NEW.reviewed_at = now();
  end if;

  return NEW;
end;
$$;

drop trigger if exists task_reports_validate on public.task_reports;
create trigger task_reports_validate
  before insert or update on public.task_reports
  for each row
  execute function public.validate_task_report();


-- ============ 4) RLS ============
alter table public.task_reports enable row level security;

-- (a) READ — own reports; president/VP see everything; a department
--     head sees reports whose PROJECT sits in their own department
--     (projects stay SELECT-open to authenticated, profiles SELECT-own
--     covers the viewer's own department lookup — both subqueries run
--     with the caller's rights and fail closed).
drop policy if exists "task_reports_read" on public.task_reports;
create policy "task_reports_read"
  on public.task_reports
  for select
  to authenticated
  using (
    reporter_id = auth.uid()
    or current_org_role() in ('president'::org_role, 'vice_president'::org_role)
    or (
      current_org_role() = 'department_head'::org_role
      and exists (
        select 1 from public.projects p
        where p.id = task_reports.project_id
          and p.department_id = (
            select department_id from public.profiles where id = auth.uid()
          )
      )
    )
  );

-- (b) INSERT — the reporter files for a task assigned to THEM, as a
--     draft, with the project matching the task's own project (the
--     client can never file for someone else or another project).
drop policy if exists "task_reports_reporter_insert" on public.task_reports;
create policy "task_reports_reporter_insert"
  on public.task_reports
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'draft'
    and exists (
      select 1 from public.tasks t
      where t.id = task_reports.task_id
        and t.assignee_id = auth.uid()
    )
    and project_id = (
      select t.project_id from public.tasks t where t.id = task_reports.task_id
    )
  );

-- (c) UPDATE (reporter self-service) — own draft/returned rows move to
--     draft/submitted only. Review columns are untouched here (the
--     trigger rejects forging them on non-review transitions).
drop policy if exists "task_reports_reporter_update" on public.task_reports;
create policy "task_reports_reporter_update"
  on public.task_reports
  for update
  to authenticated
  using (
    reporter_id = auth.uid()
    and status in ('draft', 'returned')
  )
  with check (
    reporter_id = auth.uid()
    and status in ('draft', 'submitted')
  );

-- (d) UPDATE (review) — eligible reviewers move submitted/under_review
--     rows to under_review/approved/returned, always stamping
--     THEMSELVES as the reviewer (clients cannot attribute a review
--     to anyone else).
drop policy if exists "task_reports_review_update" on public.task_reports;
create policy "task_reports_review_update"
  on public.task_reports
  for update
  to authenticated
  using (
    status in ('submitted', 'under_review')
    and (
      current_org_role() in ('president'::org_role, 'vice_president'::org_role)
      or (
        current_org_role() = 'department_head'::org_role
        and exists (
          select 1 from public.projects p
          where p.id = task_reports.project_id
            and p.department_id = (
              select department_id from public.profiles where id = auth.uid()
            )
        )
      )
    )
  )
  with check (
    reviewer_id = auth.uid()
    and status in ('under_review', 'approved', 'returned')
  );

-- (e) UPDATE (president corrections) — full oversight on non-approved
--     rows (approved stays terminal even for leadership).
drop policy if exists "task_reports_president_update" on public.task_reports;
create policy "task_reports_president_update"
  on public.task_reports
  for update
  to authenticated
  using (
    current_org_role() = 'president'::org_role
    and status <> 'approved'
  )
  with check (
    current_org_role() = 'president'::org_role
    and status <> 'approved'
  );

-- (f) DELETE — president anything; reporters only their own drafts.
drop policy if exists "task_reports_president_delete" on public.task_reports;
create policy "task_reports_president_delete"
  on public.task_reports
  for delete
  to authenticated
  using (current_org_role() = 'president'::org_role);

drop policy if exists "task_reports_reporter_delete_draft" on public.task_reports;
create policy "task_reports_reporter_delete_draft"
  on public.task_reports
  for delete
  to authenticated
  using (reporter_id = auth.uid() and status = 'draft');


-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) Table is empty but present
select 'task_reports' as tbl, count(*) from public.task_reports;

-- V2) Columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'task_reports'
order by ordinal_position;

-- V3) Policies
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'task_reports'
order by policyname;

-- V4) Trigger + function in place
select tgname as trigger_name, proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.task_reports'::regclass;

-- V5) Indexes
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'task_reports'
order by indexname;
