-- ============================================================
-- ATecHS Hub — OPTIONAL: promote your account to president
-- ------------------------------------------------------------
-- Run ONLY AFTER the profiles fix (Option A or B).
-- SQL Editor runs as the `postgres` role, which bypasses RLS —
-- normal users still cannot change roles, because the app only
-- has a SELECT policy (no UPDATE policy exists).
--
-- This sets patdz2925@gmail.com → role 'president' and creates
-- the profile row first if it does not exist yet.
-- ============================================================

insert into public.profiles (id, name, role)
select
  u.id,
  split_part(u.email, '@', 1),
  'president'
from auth.users u
where u.email = 'patdz2925@gmail.com'
on conflict (id) do update set role = excluded.role;

-- If the row already existed and its name was empty, fill it in:
update public.profiles p
   set name = split_part(u.email, '@', 1)
  from auth.users u
 where u.id = p.id
   and u.email = 'patdz2925@gmail.com'
   and nullif(p.name, '') is null;

-- Verify:
select u.email, p.name, p.role
  from auth.users u
  join public.profiles p on p.id = u.id
 where u.email = 'patdz2925@gmail.com';
