-- ============================================================
-- ATecHS Hub — DEV SEED (manual, optional, clearly separated)
-- ------------------------------------------------------------
-- Run ONLY after projects-reconcile.sql has been applied.
-- NOT real ATecHS Society records — every title starts with [DEV],
-- and the rows are easy to purge:
--
--   delete from public.project_departments
--    where project_id in (select id from public.projects where title like '[DEV]%');
--   delete from public.project_members
--    where project_id in (select id from public.projects where title like '[DEV]%');
--   delete from public.projects where title like '[DEV]%';
--
-- SQL Editor runs as postgres (bypasses RLS), so this works even
-- though project INSERT is president-only for the app.
-- Idempotent: every insert is guarded by a title check.
-- ============================================================

-- 1) ACTIVE sandbox — exercises: Active filter, progress bar,
--    multi-department links, member assignment, location, priority.
insert into public.projects
  (title, description, stage, priority, project_type,
   start_date, end_date, location, progress,
   department_id, created_by, completed_at, archived_at)
select
  '[DEV] Operations Sandbox (seed)',
  'Dev-only sandbox created by seed-dev-projects.sql — not a real ATecHS record.',
  'live', 'high', 'workshop',
  date '2026-09-01', date '2026-09-30', 'ATecHS Room', 40,
  (select id from public.departments order by name limit 1),
  (select id from public.profiles order by created_at limit 1),
  null, null
where not exists (
  select 1 from public.projects where title = '[DEV] Operations Sandbox (seed)'
);

-- 2) COMPLETED sandbox — exercises: Completed filter, progress = 100,
--    completed_at timestamp.
insert into public.projects
  (title, description, stage, priority, project_type,
   start_date, end_date, location, progress,
   department_id, created_by, completed_at, archived_at)
select
  '[DEV] Completed Sandbox (seed)',
  'Dev-only completed example — not a real ATecHS record.',
  'accomplished', 'normal', 'outreach',
  date '2026-05-01', date '2026-05-03', 'Community Hall', 100,
  (select id from public.departments order by name offset 1 limit 1),
  (select id from public.profiles order by created_at limit 1),
  timestamptz '2026-05-03 17:00:00+08', null
where not exists (
  select 1 from public.projects where title = '[DEV] Completed Sandbox (seed)'
);

-- 3) ARCHIVED sandbox — exercises: Archived filter, archived_at,
--    archive appearing in the digital-archive flow.
insert into public.projects
  (title, description, stage, priority, project_type,
   start_date, end_date, location, progress,
   department_id, created_by, completed_at, archived_at)
select
  '[DEV] Archived Sandbox (seed)',
  'Dev-only archived example — not a real ATecHS record.',
  'archived', 'low', 'general',
  date '2025-11-10', date '2025-11-12', 'Main Auditorium', 100,
  null,
  (select id from public.profiles order by created_at limit 1),
  timestamptz '2025-11-12 18:00:00+08',
  timestamptz '2026-01-05 09:00:00+08'
where not exists (
  select 1 from public.projects where title = '[DEV] Archived Sandbox (seed)'
);

-- 4) Multi-department links for the sandbox project
insert into public.project_departments (project_id, department_id)
select p.id, d.id
from public.projects p
cross join (
  select id from public.departments order by name limit 2
) d
where p.title = '[DEV] Operations Sandbox (seed)'
on conflict do nothing;

-- 5) Your profile as an assigned member ("Lead") on the sandbox
insert into public.project_members (project_id, profile_id, role)
select p.id, pr.id, 'Lead'
from public.projects p
cross join (
  select id from public.profiles order by created_at limit 1
) pr
where p.title = '[DEV] Operations Sandbox (seed)'
on conflict do nothing;

-- Check:
select title, stage, priority, progress, start_date, end_date,
       completed_at, archived_at
from public.projects
order by created_at;
