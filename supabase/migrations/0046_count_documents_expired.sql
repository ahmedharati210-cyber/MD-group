-- Count documents past expiry (matches papers list "منتهية"). SECURITY INVOKER → RLS applies.

create or replace function public.count_documents_expired()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.documents d
  where d.expires_on is not null
    and d.expires_on < current_date;
$$;

revoke all on function public.count_documents_expired() from public;
grant execute on function public.count_documents_expired() to authenticated;
grant execute on function public.count_documents_expired() to service_role;
