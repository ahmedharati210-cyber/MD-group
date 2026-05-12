-- Count documents in the "expiring soon" window (same logic as paper list + cron window,
-- but excludes already-expired rows). SECURITY INVOKER so documents RLS applies.

create or replace function public.count_documents_expiring_soon()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.documents d
  where d.expires_on is not null
    and d.expires_on >= current_date
    and current_date >= (d.expires_on - interval '1 month');
$$;

revoke all on function public.count_documents_expiring_soon() from public;
grant execute on function public.count_documents_expiring_soon() to authenticated;
grant execute on function public.count_documents_expiring_soon() to service_role;
