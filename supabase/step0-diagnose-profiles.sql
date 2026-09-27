-- ============================================================
-- ATecHS Hub — STEP 0: READ-ONLY diagnosis of public.profiles
-- ------------------------------------------------------------
-- Run this FIRST in: Supabase Dashboard → SQL Editor → New query.
-- It changes NOTHING. Paste the output (or confirm) before you
-- approve fix-A or fix-B. Needed because the app's probes show
-- the table exists with a DIFFERENT schema than expected:
--     id ✅  name ❌  role ✅  department_id ✅  created_at ❌
-- ============================================================

-- 1) How many rows exist, and what they contain
--    (this answers: "what would a DROP destroy?")
select count(*) as row_count from public.profiles;
select * from public.profiles order by role, id;

-- 2) Actual columns / types / defaults
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
 order by ordinal_position;

-- 3) Constraints (PRIMARY KEY / FOREIGN KEY / CHECK on role)
select conname, contype, pg_get_constraintdef(oid) as definition
  from pg_constraint
 where conrelid = 'public.profiles'::regclass
 order by contype, conname;

-- 4) RLS state and EVERY existing policy
--    (canonical design ends up with exactly ONE: profiles_select_own)
select relrowsecurity as rls_enabled
  from pg_class where oid = 'public.profiles'::regclass;

select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles';

-- 5) Triggers sitting ON profiles (canonical design has NONE)
select tgname, tgenabled
  from pg_trigger
 where tgrelid = 'public.profiles'::regclass and not tgisinternal;

-- 6) Triggers on auth.users
--    Canonical design = ONLY "on_auth_user_created".
--    If this lists ANYTHING ELSE, STOP and tell me — a foreign
--    signup trigger could break new signups after the fix.
select tgname
  from pg_trigger
 where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- 7) Is profiles.role our TEXT column, or a foreign enum type?
--    The policies reference 'president'::org_role, so role may be
--    an enum. If it is, Option A/B need value-compatibility care.
select column_name, data_type, udt_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'profiles'
   and column_name = 'role';

select t.typname as enum_type, e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
 where t.typname = 'org_role'
 order by e.enumsortorder;

-- 8) Foreign template objects referenced by the old policies
--    (leftover from whatever starter SQL created them; harmless
--     once the policies are gone, but I want to see them)
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc
 where proname = 'current_org_role';
