-- =============================================================================
-- Al Itqan QA Testing module
-- - Seed company «شركة الإتقان العالمي» (slug: itqan)
-- - Per-user testing_access_enabled on profiles
-- - qa_projects → qa_sections → qa_test_items
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Al Itqan company
-- ---------------------------------------------------------------------------
insert into public.companies (name_ar, name_en, slug, display_order, active)
values ('شركة الإتقان العالمي', 'Al Itqan International', 'itqan', 50, true)
on conflict (slug) do update
set
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  active = true;

-- ---------------------------------------------------------------------------
-- 2. Per-user access toggle
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists testing_access_enabled boolean not null default false;

comment on column public.profiles.testing_access_enabled is
  'Super-admin grant: user can see and use the Al Itqan testing module.';

-- ---------------------------------------------------------------------------
-- 3. QA project status enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.qa_project_status as enum ('active', 'done');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.qa_test_result as enum ('pass', 'bug', 'improve');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.qa_projects (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  description text,
  status      public.qa_project_status not null default 'active',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists qa_projects_company_idx on public.qa_projects(company_id);
create index if not exists qa_projects_status_idx on public.qa_projects(status);

create table if not exists public.qa_sections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.qa_projects(id) on delete cascade,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists qa_sections_project_idx on public.qa_sections(project_id);

create table if not exists public.qa_test_items (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.qa_sections(id) on delete cascade,
  project_id   uuid not null references public.qa_projects(id) on delete cascade,
  title        text not null,
  description  text,
  assigned_to  uuid references public.profiles(id) on delete set null,
  result       public.qa_test_result,
  result_note  text,
  tested_by    uuid references public.profiles(id) on delete set null,
  tested_at    timestamptz,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists qa_test_items_section_idx on public.qa_test_items(section_id);
create index if not exists qa_test_items_project_idx on public.qa_test_items(project_id);
create index if not exists qa_test_items_assigned_idx on public.qa_test_items(assigned_to);

-- Keep updated_at fresh on qa_projects
create or replace function public.set_qa_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists qa_projects_set_updated_at on public.qa_projects;
create trigger qa_projects_set_updated_at
  before update on public.qa_projects
  for each row execute function public.set_qa_projects_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_has_testing_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_super_admin or p.testing_access_enabled
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.current_has_testing_access() from public;
grant execute on function public.current_has_testing_access() to authenticated;

create or replace function public.current_can_manage_testing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.is_super_admin
        or (
          p.testing_access_enabled
          and p.role in ('md_admin', 'company_manager')
        )
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  );
$$;

revoke all on function public.current_can_manage_testing() from public;
grant execute on function public.current_can_manage_testing() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------------
alter table public.qa_projects enable row level security;
alter table public.qa_sections enable row level security;
alter table public.qa_test_items enable row level security;

-- qa_projects
drop policy if exists "qa_projects_select" on public.qa_projects;
create policy "qa_projects_select" on public.qa_projects
  for select using (public.current_has_testing_access());

drop policy if exists "qa_projects_insert" on public.qa_projects;
create policy "qa_projects_insert" on public.qa_projects
  for insert with check (public.current_can_manage_testing());

drop policy if exists "qa_projects_update" on public.qa_projects;
create policy "qa_projects_update" on public.qa_projects
  for update using (public.current_can_manage_testing());

drop policy if exists "qa_projects_delete" on public.qa_projects;
create policy "qa_projects_delete" on public.qa_projects
  for delete using (public.current_can_manage_testing());

-- qa_sections
drop policy if exists "qa_sections_select" on public.qa_sections;
create policy "qa_sections_select" on public.qa_sections
  for select using (public.current_has_testing_access());

drop policy if exists "qa_sections_insert" on public.qa_sections;
create policy "qa_sections_insert" on public.qa_sections
  for insert with check (public.current_can_manage_testing());

drop policy if exists "qa_sections_update" on public.qa_sections;
create policy "qa_sections_update" on public.qa_sections
  for update using (public.current_can_manage_testing());

drop policy if exists "qa_sections_delete" on public.qa_sections;
create policy "qa_sections_delete" on public.qa_sections
  for delete using (public.current_can_manage_testing());

-- qa_test_items
drop policy if exists "qa_test_items_select" on public.qa_test_items;
create policy "qa_test_items_select" on public.qa_test_items
  for select using (public.current_has_testing_access());

drop policy if exists "qa_test_items_insert" on public.qa_test_items;
create policy "qa_test_items_insert" on public.qa_test_items
  for insert with check (public.current_can_manage_testing());

-- Managers: full update. Testers: update allowed by RLS; trigger below
-- restricts them to result fields only.
drop policy if exists "qa_test_items_update" on public.qa_test_items;
drop policy if exists "qa_test_items_update_manage" on public.qa_test_items;
drop policy if exists "qa_test_items_update_tester" on public.qa_test_items;
create policy "qa_test_items_update" on public.qa_test_items
  for update using (public.current_has_testing_access());

drop policy if exists "qa_test_items_delete" on public.qa_test_items;
create policy "qa_test_items_delete" on public.qa_test_items
  for delete using (public.current_can_manage_testing());

-- Testers may only change result fields; managers unrestricted
create or replace function public.qa_test_items_restrict_tester_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_can_manage_testing() then
    return new;
  end if;

  -- Non-managers: structure columns must stay identical
  if new.section_id is distinct from old.section_id
     or new.project_id is distinct from old.project_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.assigned_to is distinct from old.assigned_to
     or new.sort_order is distinct from old.sort_order
  then
    raise exception 'testers can only update test results';
  end if;

  -- Non-managers cannot clear an existing result (manager reset only)
  if old.result is not null and new.result is null then
    raise exception 'only managers can reset test results';
  end if;

  return new;
end;
$$;

drop trigger if exists qa_test_items_restrict_tester_update on public.qa_test_items;
create trigger qa_test_items_restrict_tester_update
  before update on public.qa_test_items
  for each row execute function public.qa_test_items_restrict_tester_update();

-- result_note required for bug / improve
alter table public.qa_test_items
  drop constraint if exists qa_test_items_result_note_check;
alter table public.qa_test_items
  add constraint qa_test_items_result_note_check
  check (
    result is null
    or result = 'pass'
    or (result_note is not null and length(trim(result_note)) > 0)
  );

-- Grants
grant select, insert, update, delete on public.qa_projects to authenticated;
grant select, insert, update, delete on public.qa_sections to authenticated;
grant select, insert, update, delete on public.qa_test_items to authenticated;
