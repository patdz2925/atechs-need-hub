-- ============================================================
-- ATecHS Hub — TASKS MODULE: READ-ONLY inspection (Stage 1)
-- ------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query (project
-- fjhzwjleisalttlpnblt). Changes NOTHING. Paste the full output.
--
-- Purpose: the app already probes the `tasks` table anonymously and
-- confirmed these columns exist:
--   id, title, description, project_id, assignee_id, status,
--   priority, due_date, created_at, created_by
-- Missing (do not add without need): start_date, completed_at,
--   updated_at, department_id, position, tags
-- Enum values probed: task_status = todo | in_progress | review | done
--                     priority     = low | normal | medium | high |
--                                    urgent | critical
-- Unknown and REQUIRED before touching RLS:
--   * is RLS even enabled on tasks?
--   * which policies exist (read / create / update / delete)?
--   * current_org_role() body (used by every projects policy)
-- ============================================================

-- 1) Exact column / type inventory for tasks ---------------------
select column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'tasks'
 order by ordinal_position;

-- 2) Constraints on tasks (PK / FK / CHECK) ----------------------
select con.conname, con.contype, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
 where c.relnamespace = 'public'::regnamespace and c.relname = 'tasks'
 order by con.contype, con.conname;

-- 3) RLS enabled? + EVERY policy on tasks ------------------------
select c.relname, c.relrowsecurity as rls_enabled, c.relforcerowsecurity
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relname = 'tasks';

select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'tasks'
 order by cmd, policyname;

-- 4) Table privileges granted to API roles -----------------------
select grantee, privilege_type
  from information_schema.table_privileges
 where table_schema = 'public' and table_name = 'tasks'
   and grantee in ('anon', 'authenticated')
 order by grantee, privilege_type;

-- 5) Enum types (task_status / priority / anything else) ---------
select t.typname as enum_type, e.enumlabel, e.enumsortorder
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public'
 order by t.typname, e.enumsortorder;

-- 6) RLS helper the projects policies already use ----------------
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('current_org_role', 'member_directory')
 order by p.proname;

-- 7) Row counts (postgres sees through RLS) ----------------------
select 'tasks' as tbl, count(*) from public.tasks
union all select 'projects', count(*) from public.projects
union all select 'project_members', count(*) from public.project_members
union all select 'profiles', count(*) from public.profiles;

-- 8) Indexes on tasks --------------------------------------------
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'tasks'
 order by indexname;

-- 9) Any trigger / default already maintaining projects.progress --
select c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where c.relnamespace = 'public'::regnamespace
   and not t.tgisinternal
   and c.relname in ('projects', 'tasks')
 order by c.relname, t.tgname;
