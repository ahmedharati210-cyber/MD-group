-- =============================================================================
-- MD Group — Emaar modules expansion
-- Projects / Phases / Reports / Requests / Claims / Maps / Warnings
-- Also extends contacts with trade_category
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type project_status as enum ('planning','active','completed','on_hold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type phase_status as enum ('not_started','in_progress','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_type as enum ('daily','weekly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_type as enum ('vacation','day_off','advance','equipment','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trade_category as enum ('laborer','technician','mechanic','electrician','other');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  site_id      uuid references public.sites(id) on delete set null,
  name         text not null,
  description  text,
  start_date   date,
  end_date     date,
  status       project_status not null default 'planning',
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_company_idx on public.projects(company_id);

alter table public.projects enable row level security;

create policy "projects_md_admin_all" on public.projects
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "projects_company_manager_all" on public.projects
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "projects_employee_select" on public.projects
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Project Phases
-- ---------------------------------------------------------------------------
create table if not exists public.project_phases (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  description     text,
  start_date      date,
  end_date        date,
  completion_pct  integer not null default 0 check (completion_pct >= 0 and completion_pct <= 100),
  status          phase_status not null default 'not_started',
  sort_order      integer not null default 0,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_phases_project_idx on public.project_phases(project_id);

alter table public.project_phases enable row level security;

create policy "phases_md_admin_all" on public.project_phases
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "phases_company_manager_all" on public.project_phases
  for all using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "phases_employee_select" on public.project_phases
  for select using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

create policy "phases_employee_update" on public.project_phases
  for update using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Engineer Reports
-- ---------------------------------------------------------------------------
create table if not exists public.engineer_reports (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  site_id        uuid references public.sites(id) on delete set null,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  report_type    report_type not null default 'daily',
  report_date    date not null,
  work_done      text,
  materials_used text,
  workers_count  integer,
  notes          text,
  created_at     timestamptz not null default now()
);

create index if not exists engineer_reports_company_idx on public.engineer_reports(company_id);
create index if not exists engineer_reports_author_idx  on public.engineer_reports(author_id);

alter table public.engineer_reports enable row level security;

create policy "reports_md_admin_all" on public.engineer_reports
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "reports_company_manager_all" on public.engineer_reports
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "reports_employee_own" on public.engineer_reports
  for all using (
    author_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Engineer Requests
-- ---------------------------------------------------------------------------
create table if not exists public.engineer_requests (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  requester_id     uuid not null references public.profiles(id) on delete cascade,
  request_type     request_type not null,
  description      text not null,
  requested_date   date,
  status           request_status not null default 'pending',
  manager_response text,
  responded_by     uuid references public.profiles(id) on delete set null,
  responded_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists engineer_requests_company_idx    on public.engineer_requests(company_id);
create index if not exists engineer_requests_requester_idx  on public.engineer_requests(requester_id);

alter table public.engineer_requests enable row level security;

create policy "requests_md_admin_all" on public.engineer_requests
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "requests_company_manager_all" on public.engineer_requests
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "requests_employee_own" on public.engineer_requests
  for all using (
    requester_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Manager Claims (private — employees cannot read)
-- ---------------------------------------------------------------------------
create table if not exists public.manager_claims (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title       text not null,
  description text,
  amount      numeric(12,2),
  file_url    text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists manager_claims_company_idx on public.manager_claims(company_id);

alter table public.manager_claims enable row level security;

create policy "claims_md_admin_all" on public.manager_claims
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "claims_company_manager_all" on public.manager_claims
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );
-- employees have NO policy → no access at all

-- ---------------------------------------------------------------------------
-- Map Links (Google Drive / external links)
-- ---------------------------------------------------------------------------
create table if not exists public.map_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  site_id     uuid references public.sites(id) on delete set null,
  name        text not null,
  description text,
  drive_url   text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists map_links_company_idx on public.map_links(company_id);

alter table public.map_links enable row level security;

create policy "maps_md_admin_all" on public.map_links
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "maps_company_manager_all" on public.map_links
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "maps_employee_select" on public.map_links
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Warnings
-- ---------------------------------------------------------------------------
create table if not exists public.warnings (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  sender_id         uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete cascade,
  message           text not null,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists warnings_company_idx on public.warnings(company_id);
create index if not exists warnings_target_idx  on public.warnings(target_profile_id);

alter table public.warnings enable row level security;

create policy "warnings_md_admin_all" on public.warnings
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "warnings_company_manager_all" on public.warnings
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

-- Employees see warnings addressed to them OR broadcast (null target)
create policy "warnings_employee_select" on public.warnings
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
    and (target_profile_id = auth.uid() or target_profile_id is null)
  );

-- Employees can mark their own warnings as read
create policy "warnings_employee_update" on public.warnings
  for update using (
    (select role from public.profiles where id = auth.uid()) = 'employee'
    and (target_profile_id = auth.uid() or target_profile_id is null)
  );

-- ---------------------------------------------------------------------------
-- Extend contacts with trade_category
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists trade_category trade_category;
