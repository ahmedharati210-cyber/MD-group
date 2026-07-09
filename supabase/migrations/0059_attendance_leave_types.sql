-- Leave types for attendance day records + repair one-punch punch_count.

alter table public.attendance_monthly_records
  add column if not exists leave_type text;

-- Backfill holiday flag into leave_type.
update public.attendance_monthly_records
set leave_type = 'عطلة'
where is_holiday = true
  and (leave_type is null or leave_type = '');

-- Per-day Excel imports stored punch_count=2 when check-in equals check-out.
update public.attendance_monthly_records
set punch_count = 1
where punch_count = 2
  and first_check_in is not null
  and first_check_in = last_check_out;
