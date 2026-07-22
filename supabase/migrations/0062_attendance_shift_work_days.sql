-- Work days on branch attendance shifts (JS getDay 0-6).

alter table public.attendance_shifts
  add column if not exists work_days smallint[];

comment on column public.attendance_shifts.work_days is
  'JS getDay() values 0-6 (Sun-Sat). null = all days; empty = no scheduled work days.';
