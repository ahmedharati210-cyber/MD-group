-- Migration: Fix RLS Auth Initialization Plan performance + revoke anon EXECUTE on SECURITY DEFINER functions
--
-- PART A: Recreate all RLS policies replacing bare auth.uid() and helper function
-- calls (current_role, current_company, current_is_super_admin) with scalar
-- subqueries using (SELECT auth.uid()). This allows Postgres to evaluate auth.uid()
-- once per query instead of once per row, eliminating the "Auth RLS Initialization
-- Plan" performance warning across all 16 tables.
--
-- PART B: Revoke EXECUTE on the four SECURITY DEFINER helper functions from the
-- anon and authenticated roles. These functions are only needed internally by
-- database triggers and are not meant to be callable via the REST API.

-- ── attendance ────────────────────────────────────────────────────────────────

drop policy if exists "attendance_admin"            on public.attendance;
drop policy if exists "attendance_employee_insert"  on public.attendance;
drop policy if exists "attendance_employee_self"    on public.attendance;
drop policy if exists "attendance_employee_update"  on public.attendance;
drop policy if exists "attendance_manager"          on public.attendance;

create policy "attendance_admin" on public.attendance
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "attendance_employee_insert" on public.attendance
  for insert
  with check (
    profile_id = (SELECT auth.uid())
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

create policy "attendance_employee_self" on public.attendance
  for select
  using (profile_id = (SELECT auth.uid()));

create policy "attendance_employee_update" on public.attendance
  for update
  using    (profile_id = (SELECT auth.uid()))
  with check (profile_id = (SELECT auth.uid()));

create policy "attendance_manager" on public.attendance
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── audit_log ─────────────────────────────────────────────────────────────────

drop policy if exists "audit_admin_read" on public.audit_log;

create policy "audit_admin_read" on public.audit_log
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

-- ── companies ─────────────────────────────────────────────────────────────────

drop policy if exists "companies_admin_write" on public.companies;
drop policy if exists "companies_read"        on public.companies;
drop policy if exists "companies_super_admin" on public.companies;

create policy "companies_admin_write" on public.companies
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "companies_read" on public.companies
  for select
  using ((SELECT auth.uid()) IS NOT NULL);

create policy "companies_super_admin" on public.companies
  for all
  using (
    (SELECT coalesce(is_super_admin, false) FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT coalesce(is_super_admin, false) FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── contacts ──────────────────────────────────────────────────────────────────

drop policy if exists "contacts_admin"         on public.contacts;
drop policy if exists "contacts_employee_read" on public.contacts;
drop policy if exists "contacts_manager"       on public.contacts;

create policy "contacts_admin" on public.contacts
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "contacts_employee_read" on public.contacts
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
    AND (
      company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      OR company_id IS NULL
    )
  );

create policy "contacts_manager" on public.contacts
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND (
      company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      OR company_id IS NULL
    )
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND (
      company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      OR company_id IS NULL
    )
  );

-- ── documents ─────────────────────────────────────────────────────────────────

drop policy if exists "documents_admin"            on public.documents;
drop policy if exists "documents_employee_personal" on public.documents;
drop policy if exists "documents_manager"          on public.documents;

create policy "documents_admin" on public.documents
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "documents_employee_personal" on public.documents
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
    AND (
      owner_profile_id = (SELECT auth.uid())
      OR (
        company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
        AND category = ANY (ARRAY['memo'::document_category, 'letter'::document_category])
      )
    )
  );

create policy "documents_manager" on public.documents
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── engineer_reports ──────────────────────────────────────────────────────────

drop policy if exists "reports_md_admin_all"          on public.engineer_reports;
drop policy if exists "reports_company_manager_all"   on public.engineer_reports;
drop policy if exists "reports_employee_own"          on public.engineer_reports;

create policy "reports_md_admin_all" on public.engineer_reports
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "reports_company_manager_all" on public.engineer_reports
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "reports_employee_own" on public.engineer_reports
  for all
  using (
    author_id = (SELECT auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── engineer_requests ─────────────────────────────────────────────────────────

drop policy if exists "requests_md_admin_all"        on public.engineer_requests;
drop policy if exists "requests_company_manager_all" on public.engineer_requests;
drop policy if exists "requests_employee_own"        on public.engineer_requests;

create policy "requests_md_admin_all" on public.engineer_requests
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "requests_company_manager_all" on public.engineer_requests
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "requests_employee_own" on public.engineer_requests
  for all
  using (
    requester_id = (SELECT auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── mail ──────────────────────────────────────────────────────────────────────

drop policy if exists "mail_admin"   on public.mail;
drop policy if exists "mail_manager" on public.mail;

create policy "mail_admin" on public.mail
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "mail_manager" on public.mail
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── manager_claims ────────────────────────────────────────────────────────────

drop policy if exists "claims_md_admin_all"        on public.manager_claims;
drop policy if exists "claims_company_manager_all" on public.manager_claims;

create policy "claims_md_admin_all" on public.manager_claims
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "claims_company_manager_all" on public.manager_claims
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

-- ── map_links ─────────────────────────────────────────────────────────────────

drop policy if exists "maps_md_admin_all"        on public.map_links;
drop policy if exists "maps_company_manager_all" on public.map_links;
drop policy if exists "maps_employee_select"     on public.map_links;

create policy "maps_md_admin_all" on public.map_links
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "maps_company_manager_all" on public.map_links
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "maps_employee_select" on public.map_links
  for select
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── profiles ──────────────────────────────────────────────────────────────────

drop policy if exists "profiles_admin_read"    on public.profiles;
drop policy if exists "profiles_admin_write"   on public.profiles;
drop policy if exists "profiles_manager_read"  on public.profiles;
drop policy if exists "profiles_manager_write" on public.profiles;
drop policy if exists "profiles_self_read"     on public.profiles;
drop policy if exists "profiles_self_update"   on public.profiles;
drop policy if exists "profiles_super_admin"   on public.profiles;

create policy "profiles_admin_read" on public.profiles
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "profiles_admin_write" on public.profiles
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "profiles_manager_read" on public.profiles
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

create policy "profiles_manager_write" on public.profiles
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND role = 'employee'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND role = 'employee'::user_role
  );

-- Each user can always read their own row (also prevents recursion in subqueries above)
create policy "profiles_self_read" on public.profiles
  for select
  using (id = (SELECT auth.uid()));

-- Employees can update their own profile but cannot change their role
create policy "profiles_self_update" on public.profiles
  for update
  using (id = (SELECT auth.uid()))
  with check (
    id = (SELECT auth.uid())
    AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

create policy "profiles_super_admin" on public.profiles
  for all
  using (
    (SELECT coalesce(is_super_admin, false) FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT coalesce(is_super_admin, false) FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── project_categories ────────────────────────────────────────────────────────

drop policy if exists "categories_md_admin_all"        on public.project_categories;
drop policy if exists "categories_company_manager_all" on public.project_categories;
drop policy if exists "categories_employee_select"     on public.project_categories;

create policy "categories_md_admin_all" on public.project_categories
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "categories_company_manager_all" on public.project_categories
  for all
  using (
    (SELECT company_id FROM public.projects WHERE id = project_categories.project_id)
      = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "categories_employee_select" on public.project_categories
  for select
  using (
    (SELECT company_id FROM public.projects WHERE id = project_categories.project_id)
      = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── project_tasks ─────────────────────────────────────────────────────────────

drop policy if exists "tasks_md_admin_all"        on public.project_tasks;
drop policy if exists "tasks_company_manager_all" on public.project_tasks;
drop policy if exists "tasks_employee_select"     on public.project_tasks;
drop policy if exists "tasks_employee_update"     on public.project_tasks;

create policy "tasks_md_admin_all" on public.project_tasks
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "tasks_company_manager_all" on public.project_tasks
  for all
  using (
    (SELECT company_id FROM public.projects WHERE id = project_tasks.project_id)
      = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "tasks_employee_select" on public.project_tasks
  for select
  using (
    (SELECT company_id FROM public.projects WHERE id = project_tasks.project_id)
      = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

create policy "tasks_employee_update" on public.project_tasks
  for update
  using (
    (SELECT company_id FROM public.projects WHERE id = project_tasks.project_id)
      = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── projects ──────────────────────────────────────────────────────────────────

drop policy if exists "projects_md_admin_all"        on public.projects;
drop policy if exists "projects_company_manager_all" on public.projects;
drop policy if exists "projects_employee_select"     on public.projects;

create policy "projects_md_admin_all" on public.projects
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "projects_company_manager_all" on public.projects
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "projects_employee_select" on public.projects
  for select
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
  );

-- ── sites ─────────────────────────────────────────────────────────────────────

drop policy if exists "sites_admin"        on public.sites;
drop policy if exists "sites_employee_read" on public.sites;
drop policy if exists "sites_manager"      on public.sites;

create policy "sites_admin" on public.sites
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "sites_employee_read" on public.sites
  for select
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

create policy "sites_manager" on public.sites
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  with check (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
    AND company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- ── warnings ──────────────────────────────────────────────────────────────────

drop policy if exists "warnings_md_admin_all"        on public.warnings;
drop policy if exists "warnings_company_manager_all" on public.warnings;
drop policy if exists "warnings_employee_select"     on public.warnings;
drop policy if exists "warnings_employee_update"     on public.warnings;

create policy "warnings_md_admin_all" on public.warnings
  for all
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'md_admin'::user_role
  );

create policy "warnings_company_manager_all" on public.warnings
  for all
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'company_manager'::user_role
  );

create policy "warnings_employee_select" on public.warnings
  for select
  using (
    company_id = (SELECT company_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
    AND (target_profile_id = (SELECT auth.uid()) OR target_profile_id IS NULL)
  );

create policy "warnings_employee_update" on public.warnings
  for update
  using (
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'employee'::user_role
    AND (target_profile_id = (SELECT auth.uid()) OR target_profile_id IS NULL)
  );

-- ── PART B: Revoke anon + authenticated EXECUTE on SECURITY DEFINER functions ─
-- These functions are invoked only by triggers or internal DB logic.
-- Exposing them via /rest/v1/rpc/ to unauthenticated callers is unintentional.

revoke execute on function public.handle_new_user()       from anon, authenticated;
revoke execute on function public.current_role()          from anon, authenticated;
revoke execute on function public.current_company()       from anon, authenticated;
revoke execute on function public.current_is_super_admin() from anon, authenticated;
