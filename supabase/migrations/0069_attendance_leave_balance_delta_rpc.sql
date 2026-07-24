-- Atomic leave-balance adjustment (avoids lost updates from read-modify-write).

create or replace function public.apply_attendance_leave_balance_delta(
  p_person_id uuid,
  p_annual_delta integer,
  p_sick_delta integer
)
returns table (
  annual_leave_remaining integer,
  sick_leave_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_annual_delta = 0 and p_sick_delta = 0 then
    return query
    select ap.annual_leave_remaining, ap.sick_leave_remaining
    from public.attendance_people ap
    where ap.id = p_person_id;
    return;
  end if;

  return query
  update public.attendance_people ap
  set
    annual_leave_remaining = ap.annual_leave_remaining + p_annual_delta,
    sick_leave_remaining = ap.sick_leave_remaining + p_sick_delta
  where ap.id = p_person_id
  returning ap.annual_leave_remaining, ap.sick_leave_remaining;
end;
$$;

revoke all on function public.apply_attendance_leave_balance_delta(uuid, integer, integer)
  from public;
grant execute on function public.apply_attendance_leave_balance_delta(uuid, integer, integer)
  to authenticated, service_role;

comment on function public.apply_attendance_leave_balance_delta(uuid, integer, integer) is
  'Atomically apply annual/sick leave balance deltas for one attendance person.';
