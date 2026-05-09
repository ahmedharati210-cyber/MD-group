-- Migration: Remove anon access to SECURITY DEFINER helper functions.
--
-- Supabase grants EXECUTE to PUBLIC by default for all functions in the public
-- schema. A REVOKE from the `anon` role alone does not help because the PUBLIC
-- grant still applies. The fix is to revoke from PUBLIC and then explicitly
-- re-grant to the roles that legitimately need access:
--   - authenticated: MUST keep access — RLS policies on profiles call these
--     functions and they are evaluated in the authenticated role context.
--   - service_role: keep access for admin operations.
--   - anon: revoked (no legitimate use; they'd get NULL results anyway since
--     auth.uid() returns NULL for unauthenticated requests).
--
-- After this migration, calling /rest/v1/rpc/current_role (etc.) without a
-- valid session JWT will return a 401 from the PostgREST layer before even
-- reaching the function, because the anon role no longer has EXECUTE.

revoke execute on function public.current_company()         from public;
revoke execute on function public.current_is_super_admin()  from public;
revoke execute on function public.current_role()            from public;

grant execute on function public.current_company()         to authenticated, service_role;
grant execute on function public.current_is_super_admin()  to authenticated, service_role;
grant execute on function public.current_role()            to authenticated, service_role;
