import type { AttendanceMonthlyRecord, AttendancePerson } from "@/types/db";

export function normalizeSearchQuery(q: string | null | undefined): string {
  return (q ?? "").trim().toLowerCase();
}

export function matchesAttendanceSearch(
  q: string,
  fields: (string | null | undefined)[],
): boolean {
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

export function filterPeopleBySearch(
  people: AttendancePerson[],
  q: string,
): AttendancePerson[] {
  const needle = normalizeSearchQuery(q);
  if (!needle) return people;
  return people.filter((p) =>
    matchesAttendanceSearch(needle, [
      p.full_name,
      p.external_employee_number,
      p.notes,
    ]),
  );
}

export function filterRecordsBySearch(
  records: AttendanceMonthlyRecord[],
  q: string,
): AttendanceMonthlyRecord[] {
  const needle = normalizeSearchQuery(q);
  if (!needle) return records;
  return records.filter((r) =>
    matchesAttendanceSearch(needle, [
      r.employee_name,
      r.external_employee_number,
      r.notes,
      r.shift_type,
    ]),
  );
}
