-- Migration: Remove anon/public access to public.current_is_owner().
--
-- Migration 0048 recreated current_is_owner() after 0045 revoked anon access.
-- CREATE OR REPLACE restores the default PUBLIC EXECUTE grant, so unauthenticated
-- callers can invoke /rest/v1/rpc/current_is_owner again.
--
-- authenticated must keep EXECUTE — owner SELECT policies call this helper during
-- RLS evaluation in the authenticated role context.

revoke execute on function public.current_is_owner() from public;
revoke execute on function public.current_is_owner() from anon;

grant execute on function public.current_is_owner() to authenticated, service_role;
