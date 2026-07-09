-- Per-branch attendance shifts and per-person shift assignment.

create table if not exists public.attendance_shifts (
  id                        uuid primary key default gen_random_uuid(),
  company_id                uuid not null,
  branch_id                 uuid not null,
  name                      text not null,
  start_time                time not null,
  end_time                  time not null,
  crosses_midnight          boolean not null default false,
  checkout_cutoff_time      time,
  expected_minutes          integer not null,
  late_grace_minutes        integer not null default 15,
  early_leave_grace_minutes integer not null default 15,
  active                    boolean not null default true,
  display_order             integer not null default 0,
  created_at                timestamptz not null default now(),
  unique (company_id, branch_id, name),
  foreign key (company_id, branch_id)
    references public.attendance_branches (company_id, id)
    on delete cascade
);

create index if not exists attendance_shifts_branch_idx
  on public.attendance_shifts (branch_id, display_order);

alter table public.attendance_monthly_records
  add column if not exists shift_id uuid references public.attendance_shifts(id) on delete set null,
  add column if not exists punch_count integer;

alter table public.attendance_people
  add column if not exists shift_id uuid references public.attendance_shifts(id) on delete set null;

-- Seed the four branches under شركة الطريق الصحيح.
insert into public.attendance_branches (company_id, name, display_order, active)
values
  ('089a9996-9687-4334-9b71-8f4e12e8d5d0', 'بن عاشور', 1, true),
  ('089a9996-9687-4334-9b71-8f4e12e8d5d0', 'السياحية', 2, true),
  ('089a9996-9687-4334-9b71-8f4e12e8d5d0', 'مارينا', 3, true),
  ('089a9996-9687-4334-9b71-8f4e12e8d5d0', 'النوفليين', 4, true)
on conflict (company_id, name) do update
  set display_order = excluded.display_order,
      active = excluded.active;

-- Remove leftover test branch (MD Group).
delete from public.attendance_branches
where name = 'testttt'
  and company_id = 'fc3b2bb3-e9d2-469b-9948-5313fbc49475';

alter table public.attendance_shifts enable row level security;

create policy "attendance_shifts_select" on public.attendance_shifts
  for select using (
    (select role from public.profiles where id = (select auth.uid())) = 'md_admin'::user_role
    or (
      company_id = (select company_id from public.profiles where id = (select auth.uid()))
      and (select role from public.profiles where id = (select auth.uid())) = 'company_manager'::user_role
    )
    or (select coalesce(is_super_admin, false) from public.profiles where id = (select auth.uid()))
  );

create policy "attendance_shifts_write" on public.attendance_shifts
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
