-- HR-only employee records (no auth.users row). Portal accounts are created separately from admin.

create table if not exists public.employee_directory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name text not null,
  contact_email text,
  phone text,
  job_title text,
  national_id text,
  hired_at date,
  date_of_birth date,
  gender text check (gender is null or gender in ('male', 'female')),
  nationality text,
  address text,
  department text,
  contract_type text check (
    contract_type is null
    or contract_type in ('full_time', 'part_time', 'contract', 'intern')
  ),
  contract_end_date date,
  passport_number text,
  blood_type text check (
    blood_type is null
    or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  ),
  education_level text check (
    education_level is null
    or education_level in ('high_school', 'diploma', 'bachelor', 'master', 'phd', 'other')
  ),
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  hr_notes text,
  is_active boolean not null default true,
  linked_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint employee_directory_linked_profile_unique unique (linked_profile_id)
);

create index if not exists employee_directory_company_idx
  on public.employee_directory (company_id, created_at desc);

create index if not exists employee_directory_name_idx
  on public.employee_directory using gin (full_name gin_trgm_ops);

comment on table public.employee_directory is
  'HR roster without Supabase Auth; link linked_profile_id when a portal user is provisioned later.';

alter table public.employee_directory enable row level security;

-- Read: super admin, md_admin, or company_manager for own company
create policy "employee_directory_select" on public.employee_directory
  for select using (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );

create policy "employee_directory_insert" on public.employee_directory
  for insert with check (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );

create policy "employee_directory_update" on public.employee_directory
  for update using (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  )
  with check (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );

create policy "employee_directory_delete" on public.employee_directory
  for delete using (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );
