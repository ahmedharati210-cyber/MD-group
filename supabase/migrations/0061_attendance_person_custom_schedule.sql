-- Per-person custom work schedule (times + weekdays).

alter table public.attendance_people
  add column if not exists custom_start_time time,
  add column if not exists custom_end_time time,
  add column if not exists custom_crosses_midnight boolean not null default false,
  add column if not exists custom_late_grace_minutes integer not null default 15,
  add column if not exists custom_early_leave_grace_minutes integer not null default 15,
  add column if not exists custom_work_days smallint[];

comment on column public.attendance_people.custom_start_time is
  'Personal schedule start (HH:MM). Both start and end must be set to enable custom matching.';
comment on column public.attendance_people.custom_end_time is
  'Personal schedule end (HH:MM).';
comment on column public.attendance_people.custom_work_days is
  'JS getDay() values 0-6 (Sun-Sat). null = all days; empty = no scheduled work days.';
