import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AttendanceBranch,
  AttendanceImport,
  AttendanceMonthlyRecord,
  AttendancePerson,
  AttendanceShift,
  Company,
} from "@/types/db";

export async function getAttendanceCompanies(): Promise<
  Pick<Company, "id" | "name_ar">[]
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name_ar")
    .eq("active", true)
    .order("display_order")
    .order("name_ar");
  return (data ?? []) as Pick<Company, "id" | "name_ar">[];
}

export async function getAttendanceBranches(
  companyId: string,
): Promise<AttendanceBranch[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_branches")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order")
    .order("name");
  return (data ?? []) as AttendanceBranch[];
}

export async function getAttendanceBranch(
  branchId: string,
): Promise<AttendanceBranch | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_branches")
    .select("*")
    .eq("id", branchId)
    .maybeSingle();
  return (data as AttendanceBranch | null) ?? null;
}

export async function getAttendanceImport(
  companyId: string,
  branchId: string,
  month: string,
): Promise<AttendanceImport | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_imports")
    .select("*")
    .eq("company_id", companyId)
    .eq("branch_id", branchId)
    .eq("month", month)
    .maybeSingle();
  return (data as AttendanceImport | null) ?? null;
}

export async function getMonthlyAttendanceRecords(
  importId: string,
): Promise<AttendanceMonthlyRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_monthly_records")
    .select("*")
    .eq("import_id", importId)
    .order("employee_name")
    .order("date");
  return (data ?? []) as AttendanceMonthlyRecord[];
}

export async function getAttendancePeople(
  companyId: string,
  branchId?: string | null,
): Promise<AttendancePerson[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("attendance_people")
    .select("*")
    .eq("company_id", companyId)
    .order("full_name");

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  const { data } = await query;
  return (data ?? []) as AttendancePerson[];
}

export { buildMonthSummary, buildCalendarDays, groupRecordsByDate, groupRecordsByPerson, personRecordCounts, buildBranchPayrollSummary } from "@/lib/attendance/attendance-view";
export { normalizeSearchQuery, filterPeopleBySearch, filterRecordsBySearch } from "@/lib/attendance/search";

export async function getAttendanceShifts(
  branchId: string,
): Promise<AttendanceShift[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_shifts")
    .select("*")
    .eq("branch_id", branchId)
    .order("display_order")
    .order("name");
  return (data ?? []) as AttendanceShift[];
}

export async function getAttendanceShiftsForCompany(
  companyId: string,
): Promise<AttendanceShift[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance_shifts")
    .select("*")
    .eq("company_id", companyId)
    .order("display_order")
    .order("name");
  return (data ?? []) as AttendanceShift[];
}

export async function getAttendancePeopleByExternalNumbers(
  companyId: string,
  branchId: string,
): Promise<Map<string, AttendancePerson>> {
  const people = await getAttendancePeople(companyId, branchId);
  const map = new Map<string, AttendancePerson>();
  for (const person of people) {
    map.set(person.external_employee_number.trim(), person);
  }
  return map;
}
