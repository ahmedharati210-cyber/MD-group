-- Per-company attendance month start day (1 = calendar month; 28 = 28→27 cycle).

alter table public.companies
  add column if not exists attendance_month_start_day smallint not null default 1;

alter table public.companies
  drop constraint if exists companies_attendance_month_start_day_check;

alter table public.companies
  add constraint companies_attendance_month_start_day_check
  check (attendance_month_start_day between 1 and 28);

comment on column public.companies.attendance_month_start_day is
  'Day-of-month when the attendance period starts (1–28). Labeled YYYY-MM runs from that day of the previous calendar month through the day before it in the labeled month.';
