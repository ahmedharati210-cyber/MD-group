-- Passport scan stored in Supabase Storage (`documents` bucket); path recorded here for HR zip/purge.
alter table public.employee_signup_requests
  add column if not exists passport_image_path text;

comment on column public.employee_signup_requests.passport_image_path is
  'Storage path in documents bucket (employee-signup/...); cleared after purge.';
