-- Repair migration: ensure all columns used by the Dolce signup flow exist.
-- Safe if some were already added by 0027–0030 (IF NOT EXISTS).

alter table public.employee_signup_requests
  add column if not exists blood_type text,
  add column if not exists passport_number text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists external_employee_number text,
  add column if not exists passport_image_path text;
