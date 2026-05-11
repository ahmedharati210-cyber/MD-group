-- Lock down invite RPCs: server-only (service_role). PostgREST exposed EXECUTE to anon by default.
revoke execute on function public.reserve_invite_slot(text) from anon, authenticated;
revoke execute on function public.release_invite_slot(uuid) from anon, authenticated;
