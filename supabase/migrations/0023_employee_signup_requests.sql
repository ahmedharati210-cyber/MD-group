-- Migration 0023: Employee self-signup requests (Dolce / manager approval flow)
--
-- Flow:
-- 1. Manager creates a row (service role / admin client): status=draft, invite_token, expiry.
-- 2. Employee opens /signup/[token], submits form → status=pending, token_used=true, fields filled.
-- 3. Manager approves → Supabase invite + profile update; status=approved.
--    Or rejects → status=rejected.

create table if not exists public.employee_signup_requests (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  invite_token          text not null unique,
  token_expires_at      timestamptz not null,
  token_used            boolean not null default false,
  created_by            uuid references auth.users (id) on delete set null,
  -- Submitted by employee (step 2)
  full_name             text,
  email                 text,
  phone                 text,
  national_id           text,
  job_title             text,
  department            text,
  date_of_birth         text,
  gender                text,
  nationality           text,
  address               text,
  -- Review
  status                text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  rejection_reason      text,
  reviewed_by           uuid references auth.users (id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists employee_signup_requests_company_status_idx
  on public.employee_signup_requests (company_id, status);

create index if not exists employee_signup_requests_pending_idx
  on public.employee_signup_requests (company_id)
  where status = 'pending';

alter table public.employee_signup_requests enable row level security;

-- Portal reads use the authenticated Supabase client — managers / md_admin only.
create policy "employee_signup_requests_select" on public.employee_signup_requests
  for select
  using (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );

-- Inserts/updates from app use service role (admin client) and bypass RLS.
-- No INSERT/UPDATE policies for authenticated users — keeps public signup server-only.

comment on table public.employee_signup_requests is
  'Invite-based employee signup; draft=pending form, pending=awaiting manager, approved/rejected=final.';
