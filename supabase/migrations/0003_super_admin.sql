-- =============================================================================
-- MD Group — Super admin + per-company feature flags
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Add is_super_admin to profiles
-- Super admins inherit all md_admin capabilities AND can manage feature flags
-- and grant/revoke super_admin to other md_admin users.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- Add enabled_features to companies
-- An array of feature keys that are active for this company.
-- Empty array means no features enabled; null means ALL features enabled
-- (we default to all enabled so existing companies are unaffected).
-- Possible values: 'attendance', 'planning', 'papers', 'mail', 'contacts'
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists enabled_features text[] default null;

-- ---------------------------------------------------------------------------
-- Helper: is the current user a super admin?
-- Used in RLS policies so we don't repeat the join.
-- ---------------------------------------------------------------------------
create or replace function public.current_is_super_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce(is_super_admin, false) from public.profiles where id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- RLS additions — super admin can do everything md_admin can, plus manage
-- the is_super_admin field and enabled_features.
-- We extend existing tables rather than replacing policies so the existing
-- policies remain and we only add the super_admin bypass where needed.
-- ---------------------------------------------------------------------------

-- profiles: super admin can update any profile including is_super_admin flag
drop policy if exists profiles_super_admin on public.profiles;
create policy profiles_super_admin on public.profiles for all
  using (public.current_is_super_admin())
  with check (public.current_is_super_admin());

-- companies: super admin can update enabled_features on any company
drop policy if exists companies_super_admin on public.companies;
create policy companies_super_admin on public.companies for all
  using (public.current_is_super_admin())
  with check (public.current_is_super_admin());
