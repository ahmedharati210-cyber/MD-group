-- Attendance-only roster: separate from portal profiles.

create table if not exists public.attendance_people (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies(id) on delete cascade,
  branch_id                uuid not null references public.attendance_branches(id) on delete cascade,
  external_employee_number text not null,
  full_name                text not null,
  active                   boolean not null default true,
  first_seen_at            timestamptz not null default now(),
  last_seen_at             timestamptz not null default now(),
  notes                    text,
  raw_department_hint      text,
  created_at               timestamptz not null default now(),
  unique (company_id, branch_id, external_employee_number)
);

create index if not exists attendance_people_branch_idx
  on public.attendance_people(branch_id, active, full_name);

alter table public.attendance_monthly_records
  add column if not exists attendance_person_id uuid
  references public.attendance_people(id) on delete set null;

create index if not exists attendance_monthly_records_person_idx
  on public.attendance_monthly_records(attendance_person_id, date);

alter table public.attendance_people enable row level security;

create policy "attendance_people_select" on public.attendance_people
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_people_write" on public.attendance_people
  for all using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );
