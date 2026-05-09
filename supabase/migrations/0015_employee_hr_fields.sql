-- Add extended HR fields to profiles table
alter table public.profiles
  add column if not exists date_of_birth                  date,
  add column if not exists gender                         text check (gender in ('male', 'female')),
  add column if not exists nationality                    text,
  add column if not exists address                        text,
  add column if not exists department                     text,
  add column if not exists contract_type                  text check (contract_type in ('full_time', 'part_time', 'contract', 'intern')),
  add column if not exists contract_end_date              date,
  add column if not exists passport_number                text,
  add column if not exists blood_type                     text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  add column if not exists education_level                text check (education_level in ('high_school','diploma','bachelor','master','phd','other')),
  add column if not exists emergency_contact_name         text,
  add column if not exists emergency_contact_phone        text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists hr_notes                       text;
