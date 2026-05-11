-- External payroll / attendance card number (not the portal profile UUID or internal attendance row id)
alter table public.profiles
  add column if not exists external_employee_number text;

alter table public.employee_signup_requests
  add column if not exists external_employee_number text;

comment on column public.profiles.external_employee_number is
  'Employer/payroll attendance ID (external system), distinct from portal records.';
comment on column public.employee_signup_requests.external_employee_number is
  'Submitted external employee / fingerprint attendance number before approval.';
