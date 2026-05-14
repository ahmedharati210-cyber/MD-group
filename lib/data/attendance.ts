import "server-only";

import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AttendanceRecord = {
  id: string;
  profile_id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
};

export type EmployeeRow = {
  id: string;
  full_name: string;
  company_id: string;
  company_name: string | null;
};

export type ManagerAttendanceData = {
  employees: EmployeeRow[];
  companies: { id: string; name_ar: string }[];
  rows: AttendanceRecord[];
};

/**
 * Employee's own last-30 attendance records.
 * Short TTL (30s stale) so check-in/out reflects quickly even before the
 * revalidateTag from attendance/actions.ts arrives.
 */
export async function getEmployeeAttendance(
  userId: string,
): Promise<AttendanceRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("profile_id", userId)
    .order("date", { ascending: false })
    .limit(30);

  return (data ?? []) as AttendanceRecord[];
}

/**
 * Manager/admin view: employees list + companies dropdown + today's attendance.
 * Three queries run in parallel. `selectedDate` and `filterCompanyId` are part
 * of the cache key so each date/company combination is cached separately.
 */
export async function getManagerAttendanceData(
  selectedDate: string,
  filterCompanyId: string | undefined,
): Promise<ManagerAttendanceData> {
  const supabase = await createSupabaseServerClient();

  let empQuery = supabase
    .from("profiles")
    .select("id, full_name, company_id, companies(name_ar)")
    .eq("role", "employee")
    .eq("is_active", true)
    .order("full_name");

  if (filterCompanyId) {
    empQuery = empQuery.eq("company_id", filterCompanyId);
  }

  const [{ data: empRaw }, companies, { data: rows }] = await Promise.all([
    empQuery,
    fetchCompaniesForDropdown(supabase),
    supabase.from("attendance").select("*").eq("date", selectedDate),
  ]);

  const employees: EmployeeRow[] = (empRaw ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    company_id: e.company_id!,
    company_name:
      (e as typeof e & { companies?: { name_ar: string } | null }).companies
        ?.name_ar ?? null,
  }));

  return {
    employees,
    companies: companies ?? [],
    rows: (rows ?? []) as AttendanceRecord[],
  };
}
