-- ============================================================
-- ATecHS Hub — Option A: SAFE MIGRATION (NO DROP, keeps all rows)
-- ------------------------------------------------------------
-- Run supabase/step0-diagnose-profiles.sql FIRST.
-- Converts the existing public.profiles in place to the schema
-- defined by supabase/profiles.sql (source of truth).
--
-- WHAT CHANGES
--   • adds missing columns  name (default '') and created_at (default now())
--   • normalizes any role value outside the six allowed → 'member'
--   • adds PRIMARY KEY (id) if missing
--   • adds FK id → auth.users(id) ON DELETE CASCADE if missing
--     (aborts first if orphan rows exist — nothing half-done there)
--   • replaces ANY role-related CHECK with the canonical six-role CHECK
--   • RLS: enabled; ALL existing policies dropped; recreated as
--     exactly ONE policy (SELECT own row)
--   • drops any triggers sitting on profiles (canonical = none)
--   • (re)creates the signup trigger on auth.users (member default)
--   • backfills a 'member' profile for every existing auth user
--
-- WHAT DATA COULD BE LOST
--   • No rows are ever deleted. Only invalid role STRINGS are
--     rewritten to 'member' (step0 shows current values first).
--
-- EXISTING USERS → all receive profiles via the backfill (role=member).
-- PRESIDENT       → NOT assigned here; run promote-self-president.sql.
-- NO passwords stored · NO self-role-change possible (no UPDATE policy)
-- · NO service-role key used by the frontend.
-- ============================================================

-- 1) Add the two missing columns (existing rows get the defaults) ----
alter table public.profiles
  add column if not exists name text not null default '',
  add column if not exists created_at timestamptz not null default now();

-- 1b) If role is the foreign org_role ENUM, convert it to TEXT so the
--     table matches the source-of-truth schema exactly. Lossless: the
--     enum's values were verified byte-identical to our six roles.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'role'
       and udt_name = 'org_role'
  ) then
    execute 'alter table public.profiles alter column role type text using (role::text)';
    raise notice 'profiles.role converted from org_role enum to text (values unchanged)';
  end if;
end $$;

-- 2) Normalize invalid roles BEFORE the CHECK is enforced -----------
update public.profiles
   set role = 'member'
 where role is null
    or role not in ('president', 'vice_president', 'officer', 'adviser',
                    'department_head', 'member');

-- 3) PRIMARY KEY if missing ------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and contype = 'p') then
    execute 'alter table public.profiles add primary key (id)';
  end if;
end $$;

-- 4) FK to auth.users if missing (abort on orphans) ------------------
do $$
declare orphans int;
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and contype = 'f') then
    select count(*) into orphans
      from public.profiles p
     where not exists (select 1 from auth.users u where u.id = p.id);
    if orphans > 0 then
      raise exception
        'Cannot add FK: % profile row(s) have no matching auth user — review step0 output',
        orphans;
    end if;
    execute 'alter table public.profiles
               add constraint profiles_id_fkey
               foreign key (id) references auth.users (id) on delete cascade';
  end if;
end $$;

-- 5) Canonical six-role CHECK (replace any existing role CHECK) ------
alter table public.profiles drop constraint if exists profiles_role_check;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%role%'
       and conname <> 'profiles_role_check'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
    raise notice 'Dropped existing role-related CHECK: %', c.conname;
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('president', 'vice_president', 'officer', 'adviser',
                  'department_head', 'member'));

-- 6) RLS: enabled + exactly ONE policy (drop every existing one) -----
alter table public.profiles enable row level security;

do $$
declare p record;
begin
  for p in
    select policyname, cmd from pg_policies
     where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
    raise notice 'Dropped existing policy: % (was: %)', p.policyname, p.cmd;
  end loop;
end $$;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
-- no INSERT  → only the signup trigger writes rows
-- no UPDATE  → nobody can change their own role/department
-- no DELETE  → rows are removed only via auth.users cascade

-- 7) Remove any triggers sitting on profiles (canonical = none) ------
do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
     where tgrelid = 'public.profiles'::regclass and not tgisinternal
  loop
    execute format('drop trigger %I on public.profiles', t.tgname);
    raise notice 'Dropped trigger on profiles: %', t.tgname;
  end loop;
end $$;

-- 8) Signup trigger (default role = member, no passwords involved) ----
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

-- 9) Backfill: every existing auth user gets a profile ---------------
insert into public.profiles (id, name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name',
           split_part(coalesce(u.email, ''), '@', 1)),
  'member'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 10) Verify ---------------------------------------------------------
select id, name, role, department_id, created_at
from public.profiles
order by created_at;
