-- Per-employee yearly (14) and sick (4) leave balances (manual MD-admin reset).

alter table public.attendance_people
  add column if not exists annual_leave_remaining integer not null default 14,
  add column if not exists sick_leave_remaining integer not null default 4,
  add column if not exists leave_balance_reset_at timestamptz;

comment on column public.attendance_people.annual_leave_remaining is
  'Remaining yearly vacation days (entitlement 14). May go negative.';
comment on column public.attendance_people.sick_leave_remaining is
  'Remaining sick leave days (entitlement 4). May go negative.';
comment on column public.attendance_people.leave_balance_reset_at is
  'When MD admin last reset both leave pools to entitlement.';

update public.attendance_people
set
  annual_leave_remaining = coalesce(annual_leave_remaining, 14),
  sick_leave_remaining = coalesce(sick_leave_remaining, 4)
where true;
