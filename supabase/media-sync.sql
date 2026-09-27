-- ============================================================
-- ATecHS Hub — MEDIA SYNC: folders, sync sources, Drive columns
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run AFTER supabase/media-bank.sql (missing pieces are skipped
-- safely if you run this first, but the Bank table should exist).
-- Afterwards, run the VERIFICATION block at the bottom and paste
-- its output back.
--
-- WHAT THIS ADDS (all additive, rerunnable):
--   * public.media_folders — Drive folder hierarchy (each row is a
--     folder; files live in public.media with media_folder_id).
--   * New columns on public.media for sync bookkeeping (only if
--     the media table already exists — never recreated here).
--   * public.media_sources — sync configuration (root Drive folder
--     + credentials reference). President-only: credentials must
--     never be readable by other roles.
--
-- CREDENTIAL MODEL (no OAuth in v1 — see src/lib/drive/):
--   * api_key ............ GCP API key, works for Drive folders
--                          shared as "anyone with the link".
--   * service_account_json entire service-account JSON key for
--                          private trees shared with that account.
--   Keys live ONLY in media_sources (president-only RLS) and are
--   read server-side by the sync route. Never put them in code,
--   .env committed files, or client components.
-- ============================================================


-- ============ 1) media_folders ============
create table if not exists public.media_folders (
  id                uuid primary key default gen_random_uuid(),
  drive_folder_id   text not null,
  parent_id         uuid references public.media_folders (id) on delete set null,
  name              text not null,
  project_id        uuid references public.projects (id) on delete set null,
  department_id     uuid references public.departments (id) on delete set null,
  visibility        text not null default 'organization',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_synced_at    timestamptz,

  constraint media_folders_drive_id_unique unique (drive_folder_id),
  constraint media_folders_visibility_values
    check (visibility in ('private', 'organization', 'school')),
  constraint media_folders_name_present
    check (length(btrim(name)) > 0)
);

comment on table public.media_folders is
  'Drive folder hierarchy for the Media Bank (Hub organizes, Drive stores). Files live in public.media.';

create index if not exists media_folders_parent_id_idx
  on public.media_folders (parent_id);
create index if not exists media_folders_project_id_idx
  on public.media_folders (project_id);
create index if not exists media_folders_visibility_idx
  on public.media_folders (visibility);

-- updated_at maintenance (same pattern as the other modules).
create or replace function public.touch_media_folder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists media_folders_touch_updated_at on public.media_folders;
create trigger media_folders_touch_updated_at
  before update on public.media_folders
  for each row
  execute function public.touch_media_folder_updated_at();


-- ============ 2) media: sync columns (only if the table exists) ============
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'media'
  ) then
    -- Folder membership (Hub-side hierarchy link).
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'media' and column_name = 'media_folder_id'
    ) then
      alter table public.media
        add column media_folder_id uuid references public.media_folders (id) on delete set null;
    end if;

    -- Drive-native timestamps (Hub title/metadata stay independent).
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'media' and column_name = 'drive_created_at'
    ) then
      alter table public.media add column drive_created_at timestamptz;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'media' and column_name = 'drive_modified_at'
    ) then
      alter table public.media add column drive_modified_at timestamptz;
    end if;

    -- Sync bookkeeping.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'media' and column_name = 'last_synced_at'
    ) then
      alter table public.media add column last_synced_at timestamptz;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'media' and column_name = 'archived_by_sync'
    ) then
      alter table public.media
        add column archived_by_sync boolean not null default false;
    end if;
  else
    raise notice 'public.media does not exist yet — run supabase/media-bank.sql first, then re-run this file.';
  end if;
end $$;

-- Stable external identifier: one row per Drive file, ever.
create unique index if not exists media_drive_file_id_uidx
  on public.media (drive_file_id) where drive_file_id is not null;

create index if not exists media_folder_id_idx
  on public.media (media_folder_id);
create index if not exists media_drive_modified_at_idx
  on public.media (drive_modified_at desc nulls last);


-- ============ 3) media_sources (sync configuration) ============
create table if not exists public.media_sources (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  drive_folder_id      text not null,
  api_key              text,
  service_account_json text,
  enabled              boolean not null default true,
  last_synced_at       timestamptz,
  sync_token           text,
  last_status          text,
  last_stats           jsonb,
  last_error           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint media_sources_name_present
    check (length(btrim(name)) > 0),
  constraint media_sources_root_present
    check (length(btrim(drive_folder_id)) > 0)
);

comment on table public.media_sources is
  'Media Bank sync sources (Drive roots + credentials). PRESIDENT-ONLY: rows may hold API keys / service-account JSON.';

drop trigger if exists media_sources_touch_updated_at on public.media_sources;
create trigger media_sources_touch_updated_at
  before update on public.media_sources
  for each row
  execute function public.touch_media_folder_updated_at();


-- ============ 4) RLS ============
alter table public.media_folders enable row level security;
alter table public.media_sources enable row level security;

-- Folders: same read model as media rows (private needs uploader
-- linkage, which folders lack — so: org/school + leadership +
-- department-head scope). Writes: president only (sync runs with a
-- president session; Hub mapping edits are presidential).
drop policy if exists "media_folders_read" on public.media_folders;
create policy "media_folders_read"
  on public.media_folders
  for select
  to authenticated
  using (
    visibility in ('organization', 'school')
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
  );

drop policy if exists "media_folders_president_write" on public.media_folders;
create policy "media_folders_president_write"
  on public.media_folders
  for all
  to authenticated
  using (current_org_role() = 'president'::org_role)
  with check (current_org_role() = 'president'::org_role);

-- Sources: president sees and manages everything; nobody else sees
-- anything (credentials must never leak to other roles).
drop policy if exists "media_sources_president_all" on public.media_sources;
create policy "media_sources_president_all"
  on public.media_sources
  for all
  to authenticated
  using (current_org_role() = 'president'::org_role)
  with check (current_org_role() = 'president'::org_role);


-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) Tables present
select 'media_folders' as tbl, count(*) from public.media_folders
union all select 'media_sources', count(*) from public.media_sources;

-- V2) media sync columns (empty when media-bank.sql hasn't run yet)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'media'
  and column_name in ('media_folder_id', 'drive_created_at', 'drive_modified_at',
                      'last_synced_at', 'archived_by_sync')
order by column_name;

-- V3) Policies
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('media_folders', 'media_sources')
order by tablename, policyname;

-- V4) Unique Drive-file guarantee
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and indexname = 'media_drive_file_id_uidx';
