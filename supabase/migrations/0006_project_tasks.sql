-- =============================================================================
-- MD Group — Project categories & tasks (replaces project_phases)
-- Sites and projects are unified: a project IS a site for Emaar Al Youm.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop project_phases (no real data, just created)
-- ---------------------------------------------------------------------------
drop table if exists public.project_phases cascade;
drop type if exists phase_status;

-- ---------------------------------------------------------------------------
-- 2. Add site/location columns to projects (absorbing sites info)
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists location_notes     text,
  add column if not exists manager_name       text,
  add column if not exists manager_phone      text,
  add column if not exists manager_email      text,
  add column if not exists default_engineer_id uuid references public.profiles(id) on delete set null;

create index if not exists projects_engineer_idx on public.projects(default_engineer_id);

-- ---------------------------------------------------------------------------
-- 3. Project categories
-- ---------------------------------------------------------------------------
create table if not exists public.project_categories (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists project_categories_project_idx on public.project_categories(project_id);

alter table public.project_categories enable row level security;

create policy "categories_md_admin_all" on public.project_categories
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "categories_company_manager_all" on public.project_categories
  for all using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "categories_employee_select" on public.project_categories
  for select using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- ---------------------------------------------------------------------------
-- 4. Project tasks
-- ---------------------------------------------------------------------------
create table if not exists public.project_tasks (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.project_categories(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  notes           text,
  assigned_to     uuid references public.profiles(id) on delete set null,
  is_completed    boolean not null default false,
  completed_by    uuid references public.profiles(id) on delete set null,
  completed_at    timestamptz,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists project_tasks_category_idx on public.project_tasks(category_id);
create index if not exists project_tasks_project_idx  on public.project_tasks(project_id);

alter table public.project_tasks enable row level security;

create policy "tasks_md_admin_all" on public.project_tasks
  for all using ( (select role from public.profiles where id = auth.uid()) = 'md_admin' );

create policy "tasks_company_manager_all" on public.project_tasks
  for all using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'company_manager'
  );

create policy "tasks_employee_select" on public.project_tasks
  for select using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );

-- Employees can update tasks (to mark complete / add notes)
create policy "tasks_employee_update" on public.project_tasks
  for update using (
    (select company_id from public.projects where id = project_id)
    = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'employee'
  );
