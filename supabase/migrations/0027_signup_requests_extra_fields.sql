-- Migration 0027: Add blood_type and passport_number to employee signup requests
alter table public.employee_signup_requests
  add column if not exists blood_type    text,
  add column if not exists passport_number text;
