-- =============================================================================
-- MD Group — initial schema
--
-- Run this SQL in the Supabase SQL editor (or via `supabase db push`).
-- It is idempotent where practical so you can rerun in dev.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('md_admin', 'company_manager', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late', 'leave');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_category as enum ('letter', 'contract', 'memo', 'personal', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mail_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name_ar     text not null,
  name_en     text,
  slug        text not null unique,
  logo_url    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1-1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  phone        text,
  role         user_role not null default 'employee',
  company_id   uuid references public.companies(id) on delete set null,
  job_title    text,
  national_id  text,
  hired_at     date,
  is_active    boolean not null default true,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create index if not exists profiles_company_idx on public.profiles(company_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- Helper: current user's role + company, cached via SECURITY DEFINER so RLS
-- policies don't trigger recursive lookups.
create or replace function public.current_role() returns user_role
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_company() returns uuid
  language sql stable security definer set search_path = public as
$$ select company_id from public.profiles where id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  date         date not null,
  check_in     timestamptz,
  check_out    timestamptz,
  status       attendance_status not null default 'present',
  notes        text,
  created_at   timestamptz not null default now(),
  unique (profile_id, date)
);

create index if not exists attendance_company_date_idx
  on public.attendance(company_id, date desc);
create index if not exists attendance_profile_date_idx
  on public.attendance(profile_id, date desc);

-- ---------------------------------------------------------------------------
-- documents (papers / letters / contracts / memos / personal)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  owner_profile_id  uuid references public.profiles(id) on delete set null,
  title             text not null,
  category          document_category not null default 'other',
  storage_path      text not null,
  mime_type         text,
  size_bytes        bigint,
  content_text      text,
  search_vector     tsvector generated always as (
    to_tsvector('simple',
      coalesce(title, '') || ' ' || coalesce(content_text, ''))
  ) stored,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists documents_company_idx on public.documents(company_id);
create index if not exists documents_category_idx on public.documents(category);
create index if not exists documents_search_idx
  on public.documents using gin(search_vector);
create index if not exists documents_title_trgm_idx
  on public.documents using gin(title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- mail
-- ---------------------------------------------------------------------------
create table if not exists public.mail (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  direction            mail_direction not null,
  subject              text not null,
  body                 text,
  from_name            text,
  to_name              text,
  status               text,
  related_document_id  uuid references public.documents(id) on delete set null,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists mail_company_idx on public.mail(company_id);
create index if not exists mail_direction_idx on public.mail(direction);

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete cascade,
  full_name     text not null,
  title         text,
  organization  text,
  phone         text,
  email         text,
  notes         text,
  tags          text[],
  created_at    timestamptz not null default now()
);

create index if not exists contacts_company_idx on public.contacts(company_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log(actor_id);
create index if not exists audit_log_entity_idx on public.audit_log(entity, entity_id);

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.companies   enable row level security;
alter table public.profiles    enable row level security;
alter table public.attendance  enable row level security;
alter table public.documents   enable row level security;
alter table public.mail        enable row level security;
alter table public.contacts    enable row level security;
alter table public.audit_log   enable row level security;

-- ---------------------------------------------------------------------------
-- Policies — companies
-- ---------------------------------------------------------------------------
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select
  using (auth.uid() is not null);

drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

-- ---------------------------------------------------------------------------
-- Policies — profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid());

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles for select
  using (public.current_role() = 'md_admin');

drop policy if exists profiles_manager_read on public.profiles;
create policy profiles_manager_read on public.profiles for select
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists profiles_manager_write on public.profiles;
create policy profiles_manager_write on public.profiles for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
    and role = 'employee'
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
    and role = 'employee'
  );

-- ---------------------------------------------------------------------------
-- Generic tenant policies helper
-- A company_id-scoped table: md_admin sees all, manager sees own company,
-- employee sees only rows belonging to their company (read-only where noted).
-- ---------------------------------------------------------------------------

-- attendance
drop policy if exists attendance_admin on public.attendance;
create policy attendance_admin on public.attendance for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists attendance_manager on public.attendance;
create policy attendance_manager on public.attendance for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

drop policy if exists attendance_employee_self on public.attendance;
create policy attendance_employee_self on public.attendance for select
  using (profile_id = auth.uid());

drop policy if exists attendance_employee_insert on public.attendance;
create policy attendance_employee_insert on public.attendance for insert
  with check (
    profile_id = auth.uid()
    and company_id = public.current_company()
  );

drop policy if exists attendance_employee_update on public.attendance;
create policy attendance_employee_update on public.attendance for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- documents
drop policy if exists documents_admin on public.documents;
create policy documents_admin on public.documents for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists documents_manager on public.documents;
create policy documents_manager on public.documents for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

drop policy if exists documents_employee_personal on public.documents;
create policy documents_employee_personal on public.documents for select
  using (
    public.current_role() = 'employee'
    and (
      owner_profile_id = auth.uid()
      or (company_id = public.current_company() and category in ('memo', 'letter'))
    )
  );

-- mail
drop policy if exists mail_admin on public.mail;
create policy mail_admin on public.mail for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists mail_manager on public.mail;
create policy mail_manager on public.mail for all
  using (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  )
  with check (
    public.current_role() = 'company_manager'
    and company_id = public.current_company()
  );

-- contacts
drop policy if exists contacts_admin on public.contacts;
create policy contacts_admin on public.contacts for all
  using (public.current_role() = 'md_admin')
  with check (public.current_role() = 'md_admin');

drop policy if exists contacts_manager on public.contacts;
create policy contacts_manager on public.contacts for all
  using (
    public.current_role() = 'company_manager'
    and (company_id = public.current_company() or company_id is null)
  )
  with check (
    public.current_role() = 'company_manager'
    and (company_id = public.current_company() or company_id is null)
  );

drop policy if exists contacts_employee_read on public.contacts;
create policy contacts_employee_read on public.contacts for select
  using (
    public.current_role() = 'employee'
    and (company_id = public.current_company() or company_id is null)
  );

-- audit_log (read: md_admin only; writes via service role)
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select
  using (public.current_role() = 'md_admin');

-- ---------------------------------------------------------------------------
-- Storage bucket for documents (created via Supabase dashboard or SQL below)
-- Run separately if the `storage` schema is available:
--
--   insert into storage.buckets (id, name, public)
--   values ('documents', 'documents', false)
--   on conflict (id) do nothing;
--
-- Storage policies: allow authenticated users to read/write within the
-- documents bucket; the `documents` table RLS guards visibility at the
-- metadata layer. Signed URLs are used client-side to download files.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Seed: 5 companies under MD Group
-- Rename these to match your real company names.
-- ---------------------------------------------------------------------------
insert into public.companies (name_ar, name_en, slug) values
  ('الشركة الأولى',   'Company One',   'company-one'),
  ('الشركة الثانية',  'Company Two',   'company-two'),
  ('الشركة الثالثة',  'Company Three', 'company-three'),
  ('الشركة الرابعة',  'Company Four',  'company-four'),
  ('الشركة الخامسة',  'Company Five',  'company-five')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
