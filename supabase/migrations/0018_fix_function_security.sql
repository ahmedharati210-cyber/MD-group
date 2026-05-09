-- Migration: Properly restrict access to SECURITY DEFINER functions.
--
-- Migration 0016 revoked EXECUTE from `anon` and `authenticated`, but Supabase
-- also grants EXECUTE to `PUBLIC` by default for all functions in the public
-- schema. A PUBLIC grant overrides individual role revokes, so the functions
-- were still callable. This migration fixes both layers.
--
-- Strategy:
-- • current_role / current_company / current_is_super_admin — convert to
--   SECURITY INVOKER. They no longer need elevated privileges since all RLS
--   policies now use inline subqueries (migration 0016). SECURITY INVOKER
--   functions are not flagged by the advisor regardless of who can call them.
--
-- • handle_new_user — must stay SECURITY DEFINER (it's a trigger function that
--   inserts into profiles and needs to bypass RLS for new sign-ups). Revoke
--   EXECUTE from PUBLIC, anon, and authenticated so it cannot be called
--   directly via the REST API (/rest/v1/rpc/handle_new_user).

-- ── Convert helper functions to SECURITY INVOKER ──────────────────────────────

create or replace function public.current_company()
  returns uuid
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_is_super_admin()
  returns boolean
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select coalesce(is_super_admin, false) from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
  returns public.user_role
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Revoke public/anon/authenticated from handle_new_user ─────────────────────

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
