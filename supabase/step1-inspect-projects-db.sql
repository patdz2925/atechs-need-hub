-- ============================================================
-- ATecHS Hub — STAGE 1: READ-ONLY inspection of the module tables
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query.
-- Changes NOTHING. Paste the full output back.
-- Context: probes show profiles (fixed), projects, project_members,
-- departments and tasks already EXIST with unknown schemas;
-- project_departments and events do NOT exist yet.
-- ============================================================

-- 1) Full column / type inventory ------------------------------------
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('profiles', 'projects', 'project_members',
                      'project_departments', 'departments', 'tasks')
 order by table_name, ordinal_position;

-- 2) Constraints (PRIMARY KEY / FOREIGN KEY / CHECK) ------------------
select c.relname as table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('profiles', 'projects', 'project_members',
                     'project_departments', 'departments', 'tasks')
 order by c.relname, con.contype;

-- 3) RLS enabled? + EVERY policy in the public schema -----------------
select c.relname, c.relrowsecurity as rls_enabled
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
 order by c.relname;

select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, policyname;

-- 4) Row counts (postgres sees through RLS — this is what exists) -----
select 'profiles' as tbl, count(*) from public.profiles
union all select 'projects', count(*) from public.projects
union all select 'project_members', count(*) from public.project_members
union all select 'departments', count(*) from public.departments
union all select 'tasks', count(*) from public.tasks;

-- 5) Function bodies (RLS helpers) ------------------------------------
--    current_org_role(): the spec says preserve it if in use — I need
--    its definition to integrate (its return type may still be the old
--    org_role enum while profiles.role is now text).
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('current_org_role', 'handle_new_user')
 order by p.proname;

--    Any OTHER public function touching profiles/projects (so the new
--    RLS neither duplicates nor breaks them):
select p.proname, pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname not in ('current_org_role', 'handle_new_user')
   and (pg_get_functiondef(p.oid) ilike '%profiles%'
     or pg_get_functiondef(p.oid) ilike '%project%');

-- 6) Enum types living in the public schema ---------------------------
select t.typname as enum_type, e.enumlabel
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public'
 order by t.typname, e.enumsortorder;

-- 7) Indexes on the module tables --------------------------------------
select tablename, indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('profiles', 'projects', 'project_members',
                     'departments', 'tasks')
 order by tablename;
