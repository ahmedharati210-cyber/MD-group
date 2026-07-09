-- Per-shift fingerprint acceptance windows for raw punch-log import.

alter table public.attendance_shifts
  add column if not exists check_in_window_start time,
  add column if not exists check_in_window_end time,
  add column if not exists check_out_window_start time,
  add column if not exists check_out_window_end time;
