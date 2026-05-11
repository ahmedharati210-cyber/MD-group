-- Align remote DB with 0029 if profiles.external_employee_number was never applied.
alter table public.profiles
  add column if not exists external_employee_number text;

comment on column public.profiles.external_employee_number is
  'Employer/payroll attendance ID (external system), distinct from portal records.';
