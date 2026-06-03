-- ============================================================
-- Migration: 0048_jwt_custom_claims.sql
--
-- Embeds `role`, `company_id`, and `is_super_admin` into every
-- Supabase JWT via a custom_access_token Auth Hook.
--
-- After registering the hook in the Dashboard the four SECURITY
-- DEFINER RLS helpers read claims from the JWT (in-memory,
-- ~0 ms) instead of querying `profiles` on every request
-- (~4 ms each).  Existing sessions fall back to the DB query
-- until their token refreshes (≤ 1 h), so the change is
-- completely backward-compatible.
--
-- MANUAL STEP REQUIRED after running this migration:
--   Dashboard → Authentication → Hooks → Add hook
--   Type: Custom Access Token
--   Schema: public   Function: custom_access_token_hook
-- ============================================================

-- ============================================================
-- 1. custom_access_token_hook
--    Called by Supabase Auth on every JWT issue / refresh.
--    Reads profiles once and embeds three claims into
--    app_metadata so the four helper functions below can skip
--    the DB entirely.
-- ============================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims  jsonb;
  prof    RECORD;
BEGIN
  -- Guard: malformed events are returned untouched
  IF (event ->> 'user_id') IS NULL THEN
    RETURN event;
  END IF;

  SELECT role, company_id, is_super_admin
  INTO   prof
  FROM   public.profiles
  WHERE  id = (event ->> 'user_id')::uuid;

  claims := COALESCE(event -> 'claims', '{}'::jsonb);

  -- Only embed when the profile row exists (handles service accounts
  -- or users whose profile hasn't been created yet)
  IF prof.role IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims -> 'app_metadata', '{}'::jsonb)
      || jsonb_build_object(
           'role',           prof.role::text,
           'company_id',     prof.company_id,    -- UUID or JSON null (md_admin/owner)
           'is_super_admin', prof.is_super_admin
         )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Only the Supabase auth subsystem may invoke this hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;


-- ============================================================
-- 2. Update the four RLS helper functions
--
-- Detection: check for the 'role' key in app_metadata.
--   • Present  → hook has run; use JWT value (even when null,
--                e.g. company_id for md_admin / owner)
--   • Absent   → pre-hook session; fall back to profiles query
--
-- current_is_owner() is a pure derivation of current_role()
-- and requires no extra lookup or JWT key of its own.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.jwt() -> 'app_metadata' ? 'role'
    THEN (auth.jwt() -> 'app_metadata' ->> 'role')::public.user_role
    ELSE (SELECT role FROM public.profiles WHERE id = auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.current_company()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.jwt() -> 'app_metadata' ? 'role'
    THEN NULLIF(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid
    ELSE (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.current_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.jwt() -> 'app_metadata' ? 'role'
    THEN COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false)
    ELSE (SELECT COALESCE(is_super_admin, false) FROM public.profiles WHERE id = auth.uid())
  END
$$;

-- Derived entirely from current_role() — no extra DB round-trip or JWT key needed
CREATE OR REPLACE FUNCTION public.current_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.current_role() = 'owner'::public.user_role, false)
$$;
