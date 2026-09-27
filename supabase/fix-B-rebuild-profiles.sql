-- ============================================================
-- ATecHS Hub — Option B: CLEAN REPLACEMENT (guarded) — PREFERRED
-- ------------------------------------------------------------
-- Run supabase/step0-diagnose-profiles.sql FIRST so you can see
-- every row / column / policy / trigger that exists today.
--
-- SAFETY RAILS (no unconditional destructive DROP)
--   1. ABORTS if public.profiles has MORE THAN ONE row — in that
--      case nothing is dropped and you should use Option A.
--   2. The single row (if any) is SALVAGED first: its id, role and
--      department_id are re-inserted after the rebuild, so an
--      existing role assignment survives.
--   3. Anon-visible data was probed: NONE (0 rows visible).
--
-- WHAT COULD BE LOST
--   • Any columns beyond (id, role, department_id) — step0's
--     `select *` shows exactly what they are. The app never read
--     them (it queries id/name/role/department_id/created_at and
--     errors today because name/created_at are missing).
--   • All old policies / triggers / indexes on profiles — replaced
--     by the canonical set below (that is the point of the rebuild).
--
-- WHAT HAPPENS TO RLS      → old policies drop with the table;
--                             recreated with exactly ONE (SELECT own).
-- WHAT HAPPENS TO TRIGGERS → any on profiles drop with the table;
--                             canonical signup trigger recreated on auth.users.
-- EXISTING USERS           → all backfilled below (role = member).
-- PRESIDENT ASSIGNMENT     → NOT done here; run the separate
--                             promote-self-president.sql afterwards.
--
-- NO passwords stored (credentials live in auth.users only).
-- NO self-role-change (no UPDATE policy exists).
-- NO service-role key anywhere in the frontend.
-- ============================================================

-- 1) Guard: abort if there is more than one row ----------------------
do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  raise notice 'public.profiles currently has % row(s)', n;
  if n > 1 then
    raise exception
      'ABORT: % rows found — nothing was dropped. Review step0 and use Option A instead.',
      n;
  end if;
end $$;

-- 2) Salvage the single row (if any) before the drop -----------------
--    role::text is a no-op if the column is already text, and a
--    lossless conversion if it is the foreign org_role enum
--    (whose values were verified identical to our six roles).
drop table if exists _profiles_salvage;
create temporary table _profiles_salvage as
  select id, role::text as role, department_id from public.profiles;

-- 3) Drop old table (its policies / indexes / triggers go with it) ---
drop table if exists public.profiles cascade;

-- 4) Canonical table (source of truth = supabase/profiles.sql) -------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default 'member'
    check (role in ('president', 'vice_president', 'officer', 'adviser',
                    'department_head', 'member')),
  department_id uuid, -- FK added later, when departments exists
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Identity context for each authenticated user (name, role, department). No credentials stored here.';
comment on column public.profiles.department_id is
  'Will reference departments(id) once the departments table is created (this phase: unconstrained).';

-- 5) Signup trigger: auto-profile, default role = member -------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    'member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 6) RLS: enabled, exactly ONE policy -------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
-- no INSERT  → only the signup trigger writes rows
-- no UPDATE  → nobody can change their own role/department
-- no DELETE  → rows are removed only via auth.users cascade

-- 7) Restore the salvaged row, preserving its role -------------------
insert into public.profiles (id, name, role, department_id)
select
  s.id,
  coalesce(split_part(coalesce(u.email, ''), '@', 1), ''),
  case when s.role in ('president', 'vice_president', 'officer', 'adviser',
                       'department_head', 'member')
       then s.role
       else 'member'
  end,
  s.department_id
from _profiles_salvage s
left join auth.users u on u.id = s.id
on conflict (id) do nothing;

drop table if exists _profiles_salvage;

-- 8) Backfill: every other existing auth user gets a profile ---------
insert into public.profiles (id, name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name',
           split_part(coalesce(u.email, ''), '@', 1)),
  'member'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 9) Verify -----------------------------------------------------------
select id, name, role, department_id, created_at
from public.profiles
order by created_at;
