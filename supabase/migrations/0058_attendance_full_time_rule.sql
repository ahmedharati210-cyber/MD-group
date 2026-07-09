-- Per-branch full-time override thresholds for auto shift classification.

alter table public.attendance_branches
  add column if not exists full_time_threshold_minutes integer not null default 540,
  add column if not exists full_time_expected_minutes integer not null default 840;
