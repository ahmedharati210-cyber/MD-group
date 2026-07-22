-- Mark formal papers as actively being renewed (قيد التجديد).

alter table public.documents
  add column if not exists renewal_in_progress boolean not null default false;

comment on column public.documents.renewal_in_progress is
  'When true, paper renewal is in progress (قيد التجديد).';
