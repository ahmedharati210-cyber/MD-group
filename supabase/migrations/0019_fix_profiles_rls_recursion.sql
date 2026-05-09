-- Migration: Fix RLS recursion on the profiles table.
--
-- The inline-subquery pattern (SELECT role FROM profiles WHERE id = auth.uid())
-- works safely when used in policies for OTHER tables (engineer_reports, projects,
-- etc.) because PostgreSQL evaluates that inner profiles query using profiles'
-- own SELECT policies, and profiles_self_read always allows a user to read their
-- own row — no recursion.
--
-- However, using that same inline subquery INSIDE a policy that is ITSELF on
-- the profiles table causes multi-level recursion: checking profiles_admin_read
-- triggers a sub-select on profiles, which re-evaluates profiles_admin_read,
-- which triggers another sub-select, and so on. This makes profile reads return
-- null for any user whose session check fires these policies, causing requireUser()
-- to redirect to /login in a loop.
--
-- Fix:
-- 1. Restore the three helper functions (current_role, current_company,
--    current_is_super_admin) to SECURITY DEFINER. They run as the function owner
--    (postgres), which bypasses RLS on the inner profiles lookup — no recursion.
-- 2. Revert only the profiles-table policies to use those helper functions.
--    All other tables keep the inline (SELECT auth.uid()) optimization from 0016.
-- 3. Revoke EXECUTE from `anon` only. The `authenticated` role needs EXECUTE
--    for RLS policy evaluation to work; revoking it from there breaks policies.
--    The "authenticated can call SECURITY DEFINER function" advisory warning
--    is an accepted trade-off given this constraint.

-- ── 1. Restore helper functions to SECURITY DEFINER ───────────────────────────

create or replace function public.current_company()
  returns uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_is_super_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(is_super_admin, false) from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
  returns public.user_role
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Revoke from anon (the actual security concern — callable via /rest/v1/rpc/).
-- Keep authenticated access so RLS policy expressions can invoke these functions.
revoke execute on function public.current_company()         from anon;
revoke execute on function public.current_is_super_admin()  from anon;
revoke execute on function public.current_role()            from anon;

-- ── 2. Revert profiles policies to use helper functions (avoids recursion) ────

drop policy if exists "profiles_admin_read"    on public.profiles;
drop policy if exists "profiles_admin_write"   on public.profiles;
drop policy if exists "profiles_manager_read"  on public.profiles;
drop policy if exists "profiles_manager_write" on public.profiles;
drop policy if exists "profiles_self_update"   on public.profiles;
drop policy if exists "profiles_super_admin"   on public.profiles;

-- SECURITY DEFINER functions run as postgres → no RLS on the inner lookup
create policy "profiles_admin_read" on public.profiles
  for select
  using (public.current_role() = 'md_admin'::user_role);

create policy "profiles_admin_write" on public.profiles
  for all
  using    (public.current_role() = 'md_admin'::user_role)
  with check (public.current_role() = 'md_admin'::user_role);

create policy "profiles_manager_read" on public.profiles
  for select
  using (
    public.current_role() = 'company_manager'::user_role
    AND company_id = public.current_company()
  );

create policy "profiles_manager_write" on public.profiles
  for all
  using (
    public.current_role() = 'company_manager'::user_role
    AND company_id = public.current_company()
    AND role = 'employee'::user_role
  )
  with check (
    public.current_role() = 'company_manager'::user_role
    AND company_id = public.current_company()
    AND role = 'employee'::user_role
  );

-- profiles_self_read stays as (id = (SELECT auth.uid())) — no recursion risk
-- because it never calls back into any policy that queries profiles again.

-- Self-update: use helper for role enforcement to avoid recursion in with_check
create policy "profiles_self_update" on public.profiles
  for update
  using    (id = (SELECT auth.uid()))
  with check (
    id = (SELECT auth.uid())
    AND role = public.current_role()
  );

create policy "profiles_super_admin" on public.profiles
  for all
  using    (public.current_is_super_admin())
  with check (public.current_is_super_admin());
