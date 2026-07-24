-- Atomically replace an attendance import (unique company/branch/month) and its records.

create or replace function public.replace_attendance_import(
  p_old_import_id uuid,
  p_company_id uuid,
  p_branch_id uuid,
  p_month date,
  p_file_name text,
  p_created_by uuid,
  p_matched_count integer,
  p_unmatched_count integer,
  p_warning_summary jsonb,
  p_records jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_import_id uuid;
begin
  if p_old_import_id is not null then
    delete from public.attendance_monthly_records
    where import_id = p_old_import_id;
    delete from public.attendance_imports
    where id = p_old_import_id;
  end if;

  insert into public.attendance_imports (
    company_id,
    branch_id,
    month,
    file_name,
    created_by,
    matched_count,
    unmatched_count,
    warning_summary
  )
  values (
    p_company_id,
    p_branch_id,
    p_month,
    p_file_name,
    p_created_by,
    coalesce(p_matched_count, 0),
    coalesce(p_unmatched_count, 0),
    p_warning_summary
  )
  returning id into v_new_import_id;

  if p_records is not null
     and jsonb_typeof(p_records) = 'array'
     and jsonb_array_length(p_records) > 0 then
    insert into public.attendance_monthly_records (
      import_id,
      company_id,
      branch_id,
      attendance_person_id,
      profile_id,
      external_employee_number,
      employee_name,
      date,
      first_check_in,
      last_check_out,
      total_minutes,
      shift_type,
      expected_minutes,
      late_minutes,
      early_leave_minutes,
      overtime_minutes,
      deduction_minutes,
      is_holiday,
      is_absent,
      notes,
      shift_id,
      punch_count,
      raw_payload
    )
    select
      v_new_import_id,
      p_company_id,
      p_branch_id,
      nullif(r.attendance_person_id, '')::uuid,
      null,
      r.external_employee_number,
      r.employee_name,
      r.date::date,
      nullif(r.first_check_in, '')::time,
      nullif(r.last_check_out, '')::time,
      nullif(r.total_minutes, '')::integer,
      nullif(r.shift_type, ''),
      nullif(r.expected_minutes, '')::integer,
      coalesce(nullif(r.late_minutes, '')::integer, 0),
      coalesce(nullif(r.early_leave_minutes, '')::integer, 0),
      coalesce(nullif(r.overtime_minutes, '')::integer, 0),
      coalesce(nullif(r.deduction_minutes, '')::integer, 0),
      coalesce(r.is_holiday, false),
      coalesce(r.is_absent, false),
      nullif(r.notes, ''),
      nullif(r.shift_id, '')::uuid,
      nullif(r.punch_count, '')::integer,
      coalesce(r.raw_payload, '{}'::jsonb)
    from jsonb_to_recordset(p_records) as r(
      attendance_person_id text,
      external_employee_number text,
      employee_name text,
      date text,
      first_check_in text,
      last_check_out text,
      total_minutes text,
      shift_type text,
      expected_minutes text,
      late_minutes text,
      early_leave_minutes text,
      overtime_minutes text,
      deduction_minutes text,
      is_holiday boolean,
      is_absent boolean,
      notes text,
      shift_id text,
      punch_count text,
      raw_payload jsonb
    );
  end if;

  return v_new_import_id;
end;
$$;

revoke all on function public.replace_attendance_import(
  uuid, uuid, uuid, date, text, uuid, integer, integer, jsonb, jsonb
) from public;
grant execute on function public.replace_attendance_import(
  uuid, uuid, uuid, date, text, uuid, integer, integer, jsonb, jsonb
) to authenticated, service_role;
