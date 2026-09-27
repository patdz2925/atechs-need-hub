-- ============================================================
-- ATecHS Hub — MEDIA visibility levels: public + department
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run AFTER supabase/media-bank.sql and supabase/media-sync.sql.
-- Afterwards, run the VERIFICATION block at the bottom and paste
-- its output back.
--
-- WHAT THIS ADDS (additive + rerunnable; older migrations are
-- NEVER edited after being run):
--   * visibility gains `public` and `department` on both media
--     and media_folders (old values keep working untouched).
--   * Anonymous (signed-out) SELECT policies: public + active
--     rows only. Everything else stays invisible to anon.
--   * Authenticated read gains the `department` branch (row's own
--     department, else its project's department) for everyone.
--
-- PRIVACY MODEL (enforced here, never just in UI):
--   private     → uploader + president + VP (+ DH dept-scope)
--   organization→ every signed-in user (default)
--   school      → every signed-in school user
--   public      → anyone, including signed-out guests, active only
--   department  → members of that department (+ leadership)
-- Folders carry their own visibility; contained rows carry theirs.
-- A private child of a public parent stays invisible (per-row
-- RLS). Use the "Contents too" cascade in the explorer to align
-- a whole subtree explicitly — nothing inherits silently.
-- ============================================================


-- ============ 1) Extend the visibility CHECKs ============
alter table public.media
  drop constraint if exists media_visibility_values;
alter table public.media
  add constraint media_visibility_values
  check (visibility in ('private', 'organization', 'school', 'public', 'department'));

alter table public.media_folders
  drop constraint if exists media_folders_visibility_values;
alter table public.media_folders
  add constraint media_folders_visibility_values
  check (visibility in ('private', 'organization', 'school', 'public', 'department'));


-- ============ 2) Anonymous read: public + active only ============
-- No other anon access exists in this project: private, internal
-- and archived rows (and all counts derived from them) stay hidden.

drop policy if exists "media_public_read" on public.media;
create policy "media_public_read"
  on public.media
  for select
  to anon
  using (visibility = 'public' and status = 'active');

drop policy if exists "media_folders_public_read" on public.media_folders;
create policy "media_folders_public_read"
  on public.media_folders
  for select
  to anon
  using (visibility = 'public');


-- ============ 3) Authenticated read: + public, + department ============
drop policy if exists "media_read" on public.media;
create policy "media_read"
  on public.media
  for select
  to authenticated
  using (
    visibility in ('organization', 'school', 'public')
    or uploaded_by = auth.uid()
    or current_org_role() in ('president'::org_role, 'vice_president'::org_role)
    or (
      current_org_role() = 'department_head'::org_role
      and (
        department_id = (select department_id from public.profiles where id = auth.uid())
        or exists (
          select 1 from public.projects p
          where p.id = media.project_id
            and p.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
    )
    or (
      visibility = 'department'
      and (
        department_id = (select department_id from public.profiles where id = auth.uid())
        or exists (
          select 1 from public.projects p
          where p.id = media.project_id
            and p.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
    )
  );

drop policy if exists "media_folders_read" on public.media_folders;
create policy "media_folders_read"
  on public.media_folders
  for select
  to authenticated
  using (
    visibility in ('organization', 'school', 'public')
    or current_org_role() in ('president'::org_role, 'vice_president'::org_role)
    or (
      current_org_role() = 'department_head'::org_role
      and (
        department_id = (select department_id from public.profiles where id = auth.uid())
        or exists (
          select 1 from public.projects p
          where p.id = media_folders.project_id
            and p.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
    )
    or (
      visibility = 'department'
      and (
        department_id = (select department_id from public.profiles where id = auth.uid())
        or exists (
          select 1 from public.projects p
          where p.id = media_folders.project_id
            and p.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
    )
  );


-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) CHECK constraints accept the five levels
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.media'::regclass, 'public.media_folders'::regclass)
  and conname like '%visibility%';

-- V2) Anon + authenticated read policies on both tables
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('media', 'media_folders')
  and cmd = 'SELECT'
order by tablename, policyname;

-- V3) Current visibility distribution (public rows = guest-visible)
select visibility, status, count(*) from public.media group by 1, 2 order by 1, 2;
select visibility, count(*) from public.media_folders group by 1 order by 1;
