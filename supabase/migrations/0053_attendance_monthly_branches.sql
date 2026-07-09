-- Monthly attendance: branches, imports, and per-day records (admin/manager workflow).

create table if not exists public.attendance_branches (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  code          text,
  active        boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists attendance_branches_company_idx
  on public.attendance_branches(company_id, display_order);

alter table public.profiles
  add column if not exists attendance_branch_id uuid
  references public.attendance_branches(id) on delete set null;

create index if not exists profiles_attendance_branch_idx
  on public.profiles(attendance_branch_id);

create type public.attendance_import_status as enum ('imported', 'finalized');

create table if not exists public.attendance_imports (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  branch_id       uuid not null references public.attendance_branches(id) on delete cascade,
  month           date not null,
  file_name       text,
  status          public.attendance_import_status not null default 'imported',
  created_by      uuid references public.profiles(id) on delete set null,
  matched_count   integer not null default 0,
  unmatched_count integer not null default 0,
  warning_summary jsonb,
  created_at      timestamptz not null default now(),
  unique (company_id, branch_id, month)
);

create index if not exists attendance_imports_company_month_idx
  on public.attendance_imports(company_id, month desc);

create table if not exists public.attendance_monthly_records (
  id                       uuid primary key default gen_random_uuid(),
  import_id                uuid not null references public.attendance_imports(id) on delete cascade,
  company_id               uuid not null references public.companies(id) on delete cascade,
  branch_id                uuid not null references public.attendance_branches(id) on delete cascade,
  profile_id               uuid references public.profiles(id) on delete set null,
  external_employee_number text not null,
  employee_name            text not null,
  date                     date not null,
  first_check_in           time,
  last_check_out           time,
  total_minutes            integer,
  shift_type               text,
  expected_minutes         integer,
  late_minutes             integer not null default 0,
  early_leave_minutes      integer not null default 0,
  overtime_minutes         integer not null default 0,
  deduction_minutes        integer not null default 0,
  is_holiday               boolean not null default false,
  is_absent                boolean not null default false,
  notes                    text,
  raw_payload              jsonb,
  created_at               timestamptz not null default now(),
  unique (import_id, external_employee_number, date)
);

create index if not exists attendance_monthly_records_import_idx
  on public.attendance_monthly_records(import_id, date);

create index if not exists attendance_monthly_records_profile_idx
  on public.attendance_monthly_records(profile_id, date);

alter table public.attendance_branches enable row level security;
alter table public.attendance_imports enable row level security;
alter table public.attendance_monthly_records enable row level security;

-- attendance_branches
create policy "attendance_branches_select" on public.attendance_branches
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_branches_write" on public.attendance_branches
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

-- attendance_imports
create policy "attendance_imports_select" on public.attendance_imports
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_imports_write" on public.attendance_imports
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

-- attendance_monthly_records
create policy "attendance_monthly_records_select" on public.attendance_monthly_records
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_monthly_records_write" on public.attendance_monthly_records
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

-- Tighten legacy daily attendance: employees can no longer read/write their own rows.
drop policy if exists "attendance_select" on public.attendance;
drop policy if exists "attendance_insert" on public.attendance;
drop policy if exists "attendance_update" on public.attendance;

create policy "attendance_select" on public.attendance
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_insert" on public.attendance
  for insert with check (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_update" on public.attendance
  for update using (
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
