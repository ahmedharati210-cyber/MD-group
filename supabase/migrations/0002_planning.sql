-- =============================================================================
-- MD Group — Planning module (Phase 1)
-- Adds: sites, planning_tasks, planning_task_notes, planning_task_attachments
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'done', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('normal', 'urgent', 'emergency');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- sites
-- Engineering project sites, scoped to one company.
-- ---------------------------------------------------------------------------
create table if not exists public.sites (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  name             text not null,
  location_notes   text,
  manager_name     text,
  manager_phone    text,
  manager_email    text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists sites_company_idx on public.sites(company_id);

-- ---------------------------------------------------------------------------
-- planning_tasks
-- One row per daily task per site per assigned engineer.
-- "late" is a derived state: task_date < today AND status != 'done'.
-- ---------------------------------------------------------------------------
create table if not exists public.planning_tasks (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  site_id             uuid references public.sites(id) on delete set null,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  task_date           date not null,
  title               text not null,
  description         text,
  status              task_status not null default 'todo',
  priority            task_priority not null default 'normal',
  created_by          uuid references public.profiles(id) on delete set null,
  updated_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists planning_tasks_company_date_idx
  on public.planning_tasks(company_id, task_date desc);
create index if not exists planning_tasks_site_idx
  on public.planning_tasks(site_id);
create index if not exists planning_tasks_assigned_idx
  on public.planning_tasks(assigned_profile_id);
create index if not exists planning_tasks_status_idx
  on public.planning_tasks(status);

-- Auto-update updated_at on every row change
create or replace function public.touch_planning_task()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists touch_planning_task_tg on public.planning_tasks;
create trigger touch_planning_task_tg
  before update on public.planning_tasks
  for each row execute function public.touch_planning_task();

-- ---------------------------------------------------------------------------
-- planning_task_notes
-- Notes/activity timeline per task. Authors cannot edit or delete their notes.
-- ---------------------------------------------------------------------------
create table if not exists public.planning_task_notes (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.planning_tasks(id) on delete cascade,
  author_profile_id uuid references public.profiles(id) on delete set null,
  body             text not null,
  created_at       timestamptz not null default now()
);

create index if not exists planning_task_notes_task_idx
  on public.planning_task_notes(task_id, created_at asc);

-- ---------------------------------------------------------------------------
-- planning_task_attachments
-- Metadata only. Actual file lives in Supabase Storage (or a future provider).
-- ---------------------------------------------------------------------------
create table if not exists public.planning_task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.planning_tasks(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists planning_task_attachments_task_idx
  on public.planning_task_attachments(task_id);

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.sites                     enable row level security;
alter table public.planning_tasks            enable row level security;
alter table public.planning_task_notes       enable row level security;
alter table public.planning_task_attachments enable row level security;

-- ---------------------------------------------------------------------------
-- Policies — sites
-- ---------------------------------------------------------------------------
drop policy if exists sites_admin on public.sites;
create policy sites_admin on public.sites for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists sites_manager on public.sites;
create policy sites_manager on public.sites for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

drop policy if exists sites_employee_read on public.sites;
create policy sites_employee_read on public.sites for select
  using (
    public.current_role() = 'employee'
    and company_id = public.current_company()
  );

-- ---------------------------------------------------------------------------
-- Policies — planning_tasks
-- ---------------------------------------------------------------------------
drop policy if exists planning_tasks_admin on public.planning_tasks;
create policy planning_tasks_admin on public.planning_tasks for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists planning_tasks_manager on public.planning_tasks;
create policy planning_tasks_manager on public.planning_tasks for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

-- Employees can read all tasks in their company and update any (for emergency coverage)
drop policy if exists planning_tasks_employee_read on public.planning_tasks;
create policy planning_tasks_employee_read on public.planning_tasks for select
  using (
    public.current_role() = 'employee'
    and company_id = public.current_company()
  );

drop policy if exists planning_tasks_employee_update on public.planning_tasks;
create policy planning_tasks_employee_update on public.planning_tasks for update
  using (
    public.current_role() = 'employee'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'employee'
    and company_id = public.current_company()
  );

-- ---------------------------------------------------------------------------
-- Policies — planning_task_notes
-- ---------------------------------------------------------------------------
drop policy if exists planning_task_notes_admin on public.planning_task_notes;
create policy planning_task_notes_admin on public.planning_task_notes for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists planning_task_notes_manager on public.planning_task_notes;
create policy planning_task_notes_manager on public.planning_task_notes for all
  using (
    public.current_role() = 'company_manager'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  )
  with check (
    public.current_role() = 'company_manager'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  );

drop policy if exists planning_task_notes_employee_read on public.planning_task_notes;
create policy planning_task_notes_employee_read on public.planning_task_notes for select
  using (
    public.current_role() = 'employee'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  );

drop policy if exists planning_task_notes_employee_insert on public.planning_task_notes;
create policy planning_task_notes_employee_insert on public.planning_task_notes for insert
  with check (
    public.current_role() = 'employee'
    and author_profile_id = auth.uid()
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  );

-- ---------------------------------------------------------------------------
-- Policies — planning_task_attachments
-- ---------------------------------------------------------------------------
drop policy if exists planning_task_attachments_admin on public.planning_task_attachments;
create policy planning_task_attachments_admin on public.planning_task_attachments for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists planning_task_attachments_manager on public.planning_task_attachments;
create policy planning_task_attachments_manager on public.planning_task_attachments for all
  using (
    public.current_role() = 'company_manager'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  )
  with check (
    public.current_role() = 'company_manager'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  );

drop policy if exists planning_task_attachments_employee_read on public.planning_task_attachments;
create policy planning_task_attachments_employee_read on public.planning_task_attachments for select
  using (
    public.current_role() = 'employee'
    and exists (
      select 1 from public.planning_tasks t
      where t.id = task_id
        and t.company_id = public.current_company()
    )
  );
