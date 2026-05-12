-- Paper issue / expiration dates and cron query helper (Postgres calendar month).

alter table public.documents
  add column if not exists issued_on date,
  add column if not exists expires_on date,
  add column if not exists expiry_notified_at timestamptz;

create index if not exists idx_documents_expires_on_notified
  on public.documents (company_id, expires_on)
  where expires_on is not null and expiry_notified_at is null;

comment on column public.documents.issued_on is 'Official issue date of the paper (optional).';
comment on column public.documents.expires_on is 'Expiry date; managers notified ~1 month before when cron runs.';
comment on column public.documents.expiry_notified_at is 'Set when automated expiry warning rows were created.';

-- Rows due for the one-month-before notification (matches cron predicate).
create or replace function public.documents_due_for_expiry_notification()
returns setof public.documents
language sql
stable
security definer
set search_path = public
as $$
  select d.*
  from public.documents d
  where d.expires_on is not null
    and d.expiry_notified_at is null
    and current_date >= (d.expires_on - interval '1 month');
$$;

revoke all on function public.documents_due_for_expiry_notification() from public;
grant execute on function public.documents_due_for_expiry_notification() to service_role;
