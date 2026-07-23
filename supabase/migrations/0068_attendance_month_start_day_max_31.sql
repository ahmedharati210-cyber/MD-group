-- Allow attendance month start day through to 31 (short months clamp in app logic).

alter table public.companies
  drop constraint if exists companies_attendance_month_start_day_check;

alter table public.companies
  add constraint companies_attendance_month_start_day_check
  check (attendance_month_start_day between 1 and 31);

comment on column public.companies.attendance_month_start_day is
  'Day-of-month when the attendance period starts (1–31). Labeled YYYY-MM runs from that day of the previous calendar month through the day before it in the labeled month; nonexistent days in short months are clamped.';
