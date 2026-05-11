-- Multi-use Dolce signup links: one token, many submissions (cap + expiry).
-- Legacy rows remain in employee_signup_requests (single draft row per old link).

create table if not exists public.employee_signup_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invite_token text not null unique,
  token_expires_at timestamptz not null,
  max_uses int not null default 50,
  use_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint employee_signup_invites_use_count_bounds
    check (use_count >= 0 and use_count <= max_uses)
);

create index if not exists employee_signup_invites_company_idx
  on public.employee_signup_invites (company_id);

alter table public.employee_signup_requests
  drop constraint if exists employee_signup_requests_invite_token_key;

create index if not exists employee_signup_requests_invite_token_idx
  on public.employee_signup_requests (invite_token);

alter table public.employee_signup_requests
  add column if not exists invite_id uuid references public.employee_signup_invites (id) on delete set null;

alter table public.employee_signup_invites enable row level security;

create policy "employee_signup_invites_select" on public.employee_signup_invites
  for select
  using (
    (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
    or (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
      and company_id = (select company_id from public.profiles where id = (select auth.uid()))
    )
  );

comment on table public.employee_signup_invites is
  'Reusable Dolce signup URLs: max_uses submissions until token_expires_at.';

-- Atomically consume one invite slot (returns nothing if expired or exhausted).
create or replace function public.reserve_invite_slot(p_token text)
returns table (
  invite_id uuid,
  company_id uuid,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.employee_signup_invites i
  set use_count = use_count + 1
  where i.invite_token = p_token
    and i.use_count < i.max_uses
    and i.token_expires_at > now()
  returning i.id, i.company_id, i.token_expires_at;
end;
$$;

-- Undo reserve_invite_slot after a failed signup submission (storage / DB error).
create or replace function public.release_invite_slot(p_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.employee_signup_invites
  set use_count = greatest(0, use_count - 1)
  where id = p_invite_id;
$$;

revoke all on function public.reserve_invite_slot(text) from public;
grant execute on function public.reserve_invite_slot(text) to service_role;

revoke all on function public.release_invite_slot(uuid) from public;
grant execute on function public.release_invite_slot(uuid) to service_role;
