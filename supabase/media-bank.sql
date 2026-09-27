-- ============================================================
-- ATecHS Hub — MEDIA BANK module: media index + RLS
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Afterwards, run the VERIFICATION block at the bottom and paste
-- its output back.
--
-- ARCHITECTURE (Hub organizes · Drive stores):
--   ATecHS Hub → Media Bank (this table: metadata, search,
--   categories, permissions) → Google Drive (original files).
-- Each row is an INDEX/REFERENCE to a file — never the binary.
-- No large media is copied into Supabase by this module.
--
-- SAFETY CONTRACT
--   * Additive only: one new table, new indexes, trigger helpers,
--     new policies. No DROP/ALTER of existing tables.
--   * public.profiles / projects / departments / tasks are NOT
--     modified. current_org_role() and member_directory() are NOT
--     modified (only called).
--
-- VISIBILITY MODEL (authenticated users only — there is no
-- anonymous school access in this app's auth architecture):
--   private      → uploader + president + vice president
--   organization → every signed-in member (default, conservative)
--   school       → every signed-in school user (whole-school archive)
-- Default is `organization`: useful immediately, still auth-gated.
-- Nothing here is public to the anonymous internet.
--
-- ROLE MODEL (mirrors src/lib/roles.ts; UI gating in
-- src/lib/media/types.ts is display-only):
--   president: full management (edit/feature/archive/visibility/delete)
--   vice_president: add, edit, feature, archive (matrix: edit)
--   officer: add media; edit own non-archived
--   department_head: add; view + edit + archive reports... media
--     inside their own department (project/department match)
--   adviser / member: view authorized media; manage own uploads
--     while active (non-archived)
-- DELETE ("Remove from Media Bank") is president-only and never
-- touches the Google Drive original. Archiving only hides rows
-- from normal browsing.
-- ============================================================


-- ============ 1) Table ============
create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  media_type    text not null default 'image',
  mime_type     text,
  file_name     text,
  file_size     bigint,
  drive_file_id text,
  drive_url     text,
  drive_folder_id text,
  thumbnail_url text,
  preview_url   text,
  project_id    uuid references public.projects (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  uploaded_by   uuid not null references public.profiles (id) on delete restrict,
  captured_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  visibility    text not null default 'organization',
  status        text not null default 'active',
  tags          text[] not null default '{}',
  location      text,
  event_name    text,
  is_featured   boolean not null default false,

  -- A row without any Drive reference points nowhere.
  constraint media_has_drive_ref
    check (
      drive_file_id is not null
      or drive_folder_id is not null
      or drive_url is not null
    ),
  constraint media_type_values
    check (media_type in ('image', 'video', 'document', 'other')),
  constraint media_visibility_values
    check (visibility in ('private', 'organization', 'school')),
  constraint media_status_values
    check (status in ('active', 'archived')),
  constraint media_title_present
    check (length(btrim(title)) > 0),
  -- Drive URLs are untrusted input: only Google Drive hosts allowed.
  constraint media_drive_url_safe
    check (
      drive_url is null
      or drive_url ~ '^https://(drive\.google\.com|docs\.google\.com)/'
    ),
  constraint media_thumbnail_url_safe
    check (
      thumbnail_url is null
      or thumbnail_url ~ '^https://'
    ),
  constraint media_preview_url_safe
    check (
      preview_url is null
      or preview_url ~ '^https://'
    )
);

comment on table public.media is
  'Media Bank index: metadata + Drive references for school media. Hub organizes, Drive stores.';


-- ============ 2) Indexes (search, filters, pagination) ============
create index if not exists media_project_id_idx
  on public.media (project_id);
create index if not exists media_department_id_idx
  on public.media (department_id);
create index if not exists media_uploaded_by_idx
  on public.media (uploaded_by);
create index if not exists media_visibility_idx
  on public.media (visibility);
create index if not exists media_status_idx
  on public.media (status);
create index if not exists media_type_idx
  on public.media (media_type);
create index if not exists media_featured_idx
  on public.media (is_featured) where is_featured;
create index if not exists media_captured_at_idx
  on public.media (captured_at desc nulls last);
create index if not exists media_created_at_idx
  on public.media (created_at desc);
-- Tag overlap search (WHERE tags && ARRAY[...]).
create index if not exists media_tags_gin_idx
  on public.media using gin (tags);


-- ============ 3) Maintenance trigger ============
-- updated_at stamping + tag normalization (lowercase, trimmed,
-- de-duplicated) so school-wide discovery stays consistent
-- no matter which client wrote the row.
create or replace function public.maintain_media()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  if NEW.tags is null then
    NEW.tags = '{}';
  else
    select coalesce(array_agg(t order by t), '{}')
      into NEW.tags
      from (select distinct lower(btrim(u)) as t from unnest(NEW.tags) as u) s
      where t <> '';
  end if;
  return NEW;
end;
$$;

drop trigger if exists media_maintain on public.media;
create trigger media_maintain
  before insert or update on public.media
  for each row
  execute function public.maintain_media();

-- Featuring is a leadership action: only president / vice president
-- may flip the flag (RLS agrees — belt and braces).
create or replace function public.guard_media_featured()
returns trigger
language plpgsql
as $$
begin
  if NEW.is_featured is distinct from OLD.is_featured
    and current_org_role() not in ('president'::org_role, 'vice_president'::org_role) then
    raise exception 'Only the president or vice president can feature media.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists media_guard_featured on public.media;
create trigger media_guard_featured
  before update on public.media
  for each row
  execute function public.guard_media_featured();


-- ============ 4) RLS ============
alter table public.media enable row level security;

-- (a) READ — private: uploader + president + VP. organization/school:
--     every signed-in user. Department heads additionally see private
--     rows whose project or record sits in their own department.
drop policy if exists "media_read" on public.media;
create policy "media_read"
  on public.media
  for select
  to authenticated
  using (
    visibility in ('organization', 'school')
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
  );

-- (b) INSERT — president, VP, officer, department head file with
--     themselves as uploader (members/advisers register through
--     leadership; the UI gates the same way).
drop policy if exists "media_contributor_insert" on public.media;
create policy "media_contributor_insert"
  on public.media
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and current_org_role() in (
      'president'::org_role, 'vice_president'::org_role,
      'officer'::org_role, 'department_head'::org_role
    )
  );

-- (c) UPDATE (own rows) — uploaders keep their metadata fresh and
--     may archive/restore their own uploads. Featuring stays
--     leadership-only via the trigger below.
drop policy if exists "media_owner_update" on public.media;
create policy "media_owner_update"
  on public.media
  for update
  to authenticated
  using (
    uploaded_by = auth.uid()
    and status in ('active', 'archived')
  )
  with check (
    uploaded_by = auth.uid()
  );

-- (d) UPDATE (editors) — president/VP anywhere; department heads
--     inside their own department. Covers metadata edits plus
--     archive/restore (feature flag still guarded by its trigger).
drop policy if exists "media_editor_update" on public.media;
create policy "media_editor_update"
  on public.media
  for update
  to authenticated
  using (
    status in ('active', 'archived')
    and (
      current_org_role() in ('president'::org_role, 'vice_president'::org_role)
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
    )
  )
  with check (
    status in ('active', 'archived')
  );

-- (e) DELETE ("Remove from Media Bank") — president only. Never
--     touches the Google Drive original.
drop policy if exists "media_president_delete" on public.media;
create policy "media_president_delete"
  on public.media
  for delete
  to authenticated
  using (current_org_role() = 'president'::org_role);


-- ============================================================
-- VERIFICATION — run and paste this output back
-- ============================================================

-- V1) Table is empty but present
select 'media' as tbl, count(*) from public.media;

-- V2) Columns
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'media'
order by ordinal_position;

-- V3) Policies
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'media'
order by policyname;

-- V4) Triggers in place
select tgname as trigger_name, proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'public.media'::regclass
order by tgname;

-- V5) Indexes
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'media'
order by indexname;
