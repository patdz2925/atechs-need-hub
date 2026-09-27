-- ============================================================
-- ATecHS Hub — profiles table, auto-provisioning, RLS
-- ------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Dashboard → your project → SQL Editor → New query
--   → paste this file → Run.
--
-- WHAT THIS CREATES (explained):
--
-- 1) public.profiles
--    One row per auth user, linked by the SAME uuid
--    (profiles.id = auth.users.id). Stores identity context
--    only — name / role / department. NEVER passwords: those
--    live exclusively in Supabase Auth.
--
--    role has a CHECK constraint limited to the six ATecHS
--    roles and defaults to 'member', so every new account is
--    a plain member unless a President changes it later.
--
--    department_id is uuid but intentionally has NO foreign
--    key yet — the departments table doesn't exist in this
--    phase. The FK is added when departments are built.
--
-- 2) trigger on_auth_user_created
--    Fires after every insert into auth.users and creates the
--    matching profile row automatically (SECURITY DEFINER, so
--    it runs with the function owner's rights, not the new
--    user's). Name falls back to the email prefix. Role is
--    hard-coded to 'member' — users cannot pick a role at
--    signup.
--
-- 3) Row Level Security
--    The table is locked by RLS with exactly ONE policy:
--      • authenticated users can SELECT their OWN row
--        (auth.uid() = id) — that's how the dashboard reads
--        your profile/role.
--    There is deliberately NO insert policy (only the trigger
--    writes), NO update policy (users cannot change their own
--    role/department — President-only role management gets an
--    explicit policy in a later milestone), and NO delete
--    policy. Service-role keys bypass RLS (server only).
--
-- 4) Two dev test-account helpers (commented out — run them
--    AFTER creating the test users in Authentication → Users).
-- ============================================================

-- 1) Table -----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default 'member'
    check (role in ('president', 'vice_president', 'officer', 'adviser', 'department_head', 'member')),
  department_id uuid, -- FK added later, when departments exists
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Identity context for each authenticated user (name, role, department). No credentials stored here.';
comment on column public.profiles.department_id is
  'Will reference departments(id) once the departments table is created (this phase: unconstrained).';

-- 2) Auto-create profile on signup --------------------------------
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
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    'member' -- every new user starts as a member
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

-- 3) Row Level Security ------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- No INSERT policy  → only the trigger creates rows.
-- No UPDATE policy  → users cannot touch their own role/department.
-- No DELETE policy  → profiles are removed only via auth.users cascade.

-- 4) Dev test accounts (run AFTER creating the two users in
--    Authentication → Users with auto-confirm enabled):
--
-- update public.profiles
--   set name = 'Test President', role = 'president'
--   where id = (select id from auth.users where email = 'president.test@atecshub.local');
--
-- update public.profiles
--   set name = 'Test Member', role = 'member'
--   where id = (select id from auth.users where email = 'member.test@atecshub.local');
