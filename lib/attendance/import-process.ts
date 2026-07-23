import "server-only";

import { dedupeMatchedImportRows } from "@/lib/attendance/import-dedupe";
import { detectAttendanceFileFormat } from "@/lib/attendance/attendance-format";
import { detectImportMonthMismatch } from "@/lib/attendance/import-month";
import {
  matchBlocksToAttendancePeople,
  parseRawAttendanceWorkbook,
  type MatchedImportRow,
} from "@/lib/attendance/raw-excel-parser";
import { parseAndMatchPunchLogWorkbook } from "@/lib/attendance/punch-log-import";
import {
  DEFAULT_FULL_TIME_CONFIG,
  type FullTimeConfig,
} from "@/lib/attendance/shift-matching";
import {
  getAttendanceBranch,
  getAttendancePeopleByExternalNumbers,
  getAttendanceShifts,
  getCompanyAttendanceMonthStartDay,
} from "@/lib/data/monthly-attendance";
import type { AttendanceBranch, AttendancePerson } from "@/types/db";

export type ProcessedImport = {
  rows: MatchedImportRow[];
  warnings: string[];
  format: "per_day" | "raw_punch_log" | "unknown";
  monthMismatch: ReturnType<typeof detectImportMonthMismatch>;
};

export function fullTimeConfigFromBranch(
  branch: Pick<
    AttendanceBranch,
    "full_time_threshold_minutes" | "full_time_expected_minutes"
  > | null,
): FullTimeConfig {
  if (!branch) return DEFAULT_FULL_TIME_CONFIG;
  return {
    thresholdMinutes: branch.full_time_threshold_minutes,
    expectedMinutes: branch.full_time_expected_minutes,
  };
}

export async function processAttendanceImportFile(
  buffer: ArrayBuffer,
  companyId: string,
  branchId: string,
  month: string,
): Promise<ProcessedImport | { error: string }> {
  const format = await detectAttendanceFileFormat(buffer);
  const [people, shifts, branch, monthStartDay] = await Promise.all([
    getAttendancePeopleByExternalNumbers(companyId, branchId),
    getAttendanceShifts(branchId),
    getAttendanceBranch(branchId),
    getCompanyAttendanceMonthStartDay(companyId),
  ]);
  const fullTimeConfig = fullTimeConfigFromBranch(branch);

  let rows: MatchedImportRow[] = [];
  let warnings: string[] = [];

  if (format === "raw_punch_log") {
    const matched = await parseAndMatchPunchLogWorkbook(
      buffer,
      people,
      shifts,
      fullTimeConfig,
    );
    rows = matched.rows;
    warnings = matched.warnings;
  } else if (format === "per_day") {
    const parsed = await parseRawAttendanceWorkbook(buffer);
    const matched = matchBlocksToAttendancePeople(
      parsed.blocks,
      people,
      shifts,
      fullTimeConfig,
    );
    rows = matched.rows;
    warnings = [...parsed.warnings, ...matched.warnings];
  } else {
    return { error: "صيغة الملف غير معروفة. استخدم ملف البصمة اليومي أو سجل البصمات الخام." };
  }

  const monthMismatch = detectImportMonthMismatch(
    month,
    rows.map((r) => r.date),
    monthStartDay,
  );
  if (monthMismatch) {
    warnings.unshift(monthMismatch.message);
  }

  rows = dedupeMatchedImportRows(rows, shifts, fullTimeConfig, people);

  return { rows, warnings, format, monthMismatch };
}

export function buildPeopleMap(
  people: Map<string, AttendancePerson>,
): Map<string, { id: string; full_name: string }> {
  return new Map(
    [...people.entries()].map(([k, p]) => [
      k,
      { id: p.id, full_name: p.full_name },
    ]),
  );
}
