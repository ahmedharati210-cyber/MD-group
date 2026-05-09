-- Migration 0022: Consolidate multiple permissive RLS policies.
--
-- The Supabase linter flags "Multiple Permissive Policies" as a WARN-level
-- performance issue: when a table has 3 permissive policies for the same
-- (role, action), Postgres must evaluate ALL of them for every query — even
-- when the first one already returns TRUE. This adds one full sub-select per
-- extra policy.
--
-- Fix: for the key tables queried on every portal page, collapse the
-- per-role policies into a single combined policy per SQL action. This
-- reduces SELECT evaluation from 3 policy checks to 1 for each query.
--
-- Tables fixed (highest to lowest query frequency):
--   engineer_requests  — badge count on every portal layout
--   warnings           — badge count on every portal layout
--   companies          — companies page + layout getCompanyData
--   attendance         — attendance page
--   contacts           — contacts page
--
-- NOTE: profiles table RLS uses current_role() SECURITY DEFINER functions
-- (to avoid recursion) — see migration 0019 for details. The profiles
-- policies are intentionally left as-is; changing them risks re-introducing
-- the recursion issue.

-- ── engineer_requests ─────────────────────────────────────────────────────────
-- Was: 3 policies for SELECT (md_admin_all, company_manager_all, employee_own)
-- Now: 1 combined SELECT + split DML policies

drop policy if exists "requests_md_admin_all"        on public.engineer_requests;
drop policy if exists "requests_company_manager_all" on public.engineer_requests;
drop policy if exists "requests_employee_own"        on public.engineer_requests;

create policy "requests_select" on public.engineer_requests
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      requester_id = (select auth.uid())
      and (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
    )
  );

create policy "requests_insert" on public.engineer_requests
  for insert
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      requester_id = (select auth.uid())
      and (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
    )
  );

create policy "requests_update" on public.engineer_requests
  for update
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      requester_id = (select auth.uid())
      and (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
    )
  );

create policy "requests_delete" on public.engineer_requests
  for delete
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

-- ── warnings ──────────────────────────────────────────────────────────────────
-- Was: md_admin_all (ALL) + company_manager_all (ALL) + employee_select (SELECT)
--      + employee_update (UPDATE) = 3 policies for SELECT, 3 for UPDATE
-- Now: 1 SELECT policy, 1 INSERT policy, 1 UPDATE policy, 1 DELETE policy

drop policy if exists "warnings_md_admin_all"        on public.warnings;
drop policy if exists "warnings_company_manager_all" on public.warnings;
drop policy if exists "warnings_employee_select"     on public.warnings;
drop policy if exists "warnings_employee_update"     on public.warnings;

create policy "warnings_select" on public.warnings
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
      and (target_profile_id = (select auth.uid()) or target_profile_id is null)
    )
  );

create policy "warnings_insert" on public.warnings
  for insert
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

create policy "warnings_update" on public.warnings
  for update
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
      and (target_profile_id = (select auth.uid()) or target_profile_id is null)
    )
  );

create policy "warnings_delete" on public.warnings
  for delete
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

-- ── companies ─────────────────────────────────────────────────────────────────
-- Was: companies_read (SELECT for any auth'd user) + companies_admin_write (ALL)
--      + companies_super_admin (ALL) = 3 policies for every SELECT
-- companies_read already grants SELECT to ALL authenticated users, making
-- admin_write and super_admin SELECT checks completely redundant. We split
-- those into mutation-only policies so SELECT only has 1 policy.

drop policy if exists "companies_admin_write" on public.companies;
drop policy if exists "companies_read"        on public.companies;
drop policy if exists "companies_super_admin" on public.companies;

-- Any authenticated user can read companies (unchanged behaviour)
create policy "companies_select" on public.companies
  for select
  using ((select auth.uid()) is not null);

-- Admin and super-admin can mutate companies (separate from select)
create policy "companies_insert" on public.companies
  for insert
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "companies_update" on public.companies
  for update
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "companies_delete" on public.companies
  for delete
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

-- ── attendance ────────────────────────────────────────────────────────────────
-- Was: attendance_admin (ALL) + attendance_manager (ALL) + attendance_employee_self
--      (SELECT) + attendance_employee_insert (INSERT) + attendance_employee_update
--      (UPDATE) = 3 policies for SELECT, 3 for INSERT, 3 for UPDATE, 2 for DELETE
-- Now: 1 policy per SQL action

drop policy if exists "attendance_admin"           on public.attendance;
drop policy if exists "attendance_employee_insert" on public.attendance;
drop policy if exists "attendance_employee_self"   on public.attendance;
drop policy if exists "attendance_employee_update" on public.attendance;
drop policy if exists "attendance_manager"         on public.attendance;

create policy "attendance_select" on public.attendance
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or profile_id = (select auth.uid())
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

create policy "attendance_insert" on public.attendance
  for insert
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      profile_id = (select auth.uid())
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

create policy "attendance_update" on public.attendance
  for update
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or profile_id = (select auth.uid())
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  )
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or profile_id = (select auth.uid())
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

create policy "attendance_delete" on public.attendance
  for delete
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

-- ── contacts ──────────────────────────────────────────────────────────────────
-- Was: contacts_admin (ALL) + contacts_manager (ALL) + contacts_employee_read
--      (SELECT) = 3 policies for SELECT

drop policy if exists "contacts_admin"         on public.contacts;
drop policy if exists "contacts_employee_read" on public.contacts;
drop policy if exists "contacts_manager"       on public.contacts;

create policy "contacts_select" on public.contacts
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  );

create policy "contacts_insert" on public.contacts
  for insert
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  );

create policy "contacts_update" on public.contacts
  for update
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  )
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  );

create policy "contacts_delete" on public.contacts
  for delete
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  );
