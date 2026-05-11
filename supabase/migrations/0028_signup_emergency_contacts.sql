-- Emergency contact fields on employee signup requests (mirror profiles HR fields)
alter table public.employee_signup_requests
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text;
