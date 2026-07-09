/** Client-safe attendance defaults. */
import type { Company } from "@/types/db";

/**
 * شركة الطريق الصحيح — the only company with attendance branches configured
 * today. Preselected so managers don't have to pick it every visit.
 */
export const DEFAULT_ATTENDANCE_COMPANY_ID =
  "089a9996-9687-4334-9b71-8f4e12e8d5d0";

export function pickDefaultAttendanceCompanyId(
  companies: Pick<Company, "id">[],
): string | null {
  if (companies.some((c) => c.id === DEFAULT_ATTENDANCE_COMPANY_ID)) {
    return DEFAULT_ATTENDANCE_COMPANY_ID;
  }
  return companies[0]?.id ?? null;
}
