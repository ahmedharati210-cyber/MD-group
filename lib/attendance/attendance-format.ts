import "server-only";

import { loadAttendanceSheetMatrix } from "@/lib/attendance/workbook-load";

export type AttendanceFileFormat =
  | "per_day"
  | "raw_punch_log"
  | "hikvision_month_grid"
  | "unknown";

export function detectFormatFromSheetText(joined: string): AttendanceFileFormat {
  if (
    joined.includes("أول تسجيل دخول") &&
    joined.includes("أخر تسجيل خروج")
  ) {
    return "per_day";
  }

  if (
    joined.includes("مصدر البيانات") &&
    joined.includes("رمز العمل") &&
    joined.includes("حالة البصمة")
  ) {
    return "raw_punch_log";
  }

  const hasAttendanceRecord = /attendance\s*record/i.test(joined);
  const hasEmployeeId = /employee\s*id/i.test(joined);
  const hasMadeDate = /made\s*date\s*:/i.test(joined);
  if (hasAttendanceRecord && hasEmployeeId) {
    return "hikvision_month_grid";
  }
  if (hasEmployeeId && hasMadeDate) {
    return "hikvision_month_grid";
  }

  return "unknown";
}

/**
 * Detect biometric export format from workbook headers.
 */
export async function detectAttendanceFileFormat(
  buffer: ArrayBuffer,
): Promise<AttendanceFileFormat> {
  const matrix = await loadAttendanceSheetMatrix(buffer);
  if (matrix.length === 0) return "unknown";

  let joined = "";
  for (let r = 0; r < Math.min(matrix.length, 25); r++) {
    const row = matrix[r] ?? [];
    joined += ` ${row.slice(0, 14).join(" ")}`;
  }

  return detectFormatFromSheetText(joined);
}
