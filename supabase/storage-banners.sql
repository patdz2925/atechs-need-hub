-- ============================================================
-- ATecHS Hub — project banner storage (Supabase Storage)
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Afterwards the admin event form can upload banner images
-- (drag-and-drop) instead of only accepting pasted URLs.
--
-- SAFETY CONTRACT
--   * Additive only: bucket upsert + new policies. No drops of
--     existing objects, no row changes anywhere.
--   * Public READ so event banners render for every visitor
--     (same visibility as the events themselves).
--   * WRITE (insert/update/delete) is president-only, mirroring
--     the projects RLS matrix (only presidents reach /hub/events).
-- ============================================================

-- ============ 1) Bucket (public, rerunnable) ============
insert into storage.buckets (id, name, public)
values ('project-banners', 'project-banners', true)
on conflict (id) do update set public = true;

-- ============ 2) Policies ============

-- Public read: banners are part of public event cards.
drop policy if exists "project-banners public read" on storage.objects;
create policy "project-banners public read"
  on storage.objects
  for select
  using (bucket_id = 'project-banners');

-- President-only upload.
drop policy if exists "project-banners president insert" on storage.objects;
create policy "project-banners president insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-banners'
    and current_org_role() = 'president'::org_role
  );

-- President-only replace.
drop policy if exists "project-banners president update" on storage.objects;
create policy "project-banners president update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'project-banners'
    and current_org_role() = 'president'::org_role
  )
  with check (
    bucket_id = 'project-banners'
    and current_org_role() = 'president'::org_role
  );

-- President-only removal.
drop policy if exists "project-banners president delete" on storage.objects;
create policy "project-banners president delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-banners'
    and current_org_role() = 'president'::org_role
  );

-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) Bucket exists and is public
select id, name, public from storage.buckets where id = 'project-banners';

-- V2) Policies on the bucket
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'project-banners%'
order by policyname;
