-- Migration 0044b / 0045: Owner role — SELECT-only RLS policies and helper.
-- Run after 0044_owner_role_enum.sql (enum value must be committed first).

create or replace function public.current_is_owner()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select role = 'owner' from public.profiles where id = auth.uid()),
    false
  )
$$;

revoke execute on function public.current_is_owner() from anon;

create policy "profiles_owner_read" on public.profiles
  for select
  using (public.current_is_owner());

create policy "documents_owner_select" on public.documents
  for select
  using (public.current_is_owner());

create policy "mail_owner_select" on public.mail
  for select
  using (public.current_is_owner());

drop policy if exists "contacts_select" on public.contacts;

create policy "contacts_select" on public.contacts
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select role from public.profiles where id = (select auth.uid())) = 'owner'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
      and (company_id = (select company_id from public.profiles where id = (select auth.uid())) or company_id is null)
    )
  );

drop policy if exists "attendance_select" on public.attendance;

create policy "attendance_select" on public.attendance
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select role from public.profiles where id = (select auth.uid())) = 'owner'::user_role
    or profile_id = (select auth.uid())
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
  );

drop policy if exists "warnings_select" on public.warnings;

create policy "warnings_select" on public.warnings
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select role from public.profiles where id = (select auth.uid())) = 'owner'::user_role
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

drop policy if exists "requests_select" on public.engineer_requests;

create policy "requests_select" on public.engineer_requests
  for select
  using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (select role from public.profiles where id = (select auth.uid())) = 'owner'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (
      requester_id = (select auth.uid())
      and (select role from public.profiles where id = (select auth.uid())) = 'employee'::user_role
    )
  );

create policy "projects_owner_select" on public.projects
  for select
  using (public.current_is_owner());

create policy "categories_owner_select" on public.project_categories
  for select
  using (public.current_is_owner());

create policy "tasks_owner_select" on public.project_tasks
  for select
  using (public.current_is_owner());

create policy "reports_owner_select" on public.engineer_reports
  for select
  using (public.current_is_owner());

create policy "claims_owner_select" on public.manager_claims
  for select
  using (public.current_is_owner());

create policy "maps_owner_select" on public.map_links
  for select
  using (public.current_is_owner());
