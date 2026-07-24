import type { MatchedImportRow } from "@/lib/attendance/raw-excel-parser";
import { leaveTypeToBalancePool } from "@/lib/attendance/leave-balance";

export type ImportReimportDiff = {
  existingRecordCount: number;
  newRecordCount: number;
  newDays: number;
  removedDays: number;
  changedPunches: number;
  unchanged: number;
  manuallyEditedAtRisk: number;
};

export type ExistingImportRecord = {
  external_employee_number: string;
  date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  /** Prefer reading from raw_payload.manually_overridden in callers. */
  manually_overridden?: boolean | null;
  leave_type?: string | null;
  is_holiday?: boolean | null;
  raw_payload?: Record<string, unknown> | null;
};

function rowKey(externalNumber: string, date: string): string {
  return `${externalNumber}|${date}`;
}

function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

function isManuallyOverridden(record: ExistingImportRecord): boolean {
  if (record.manually_overridden) return true;
  return Boolean(record.raw_payload?.manually_overridden);
}

function isProtectedLeaveOrHoliday(record: ExistingImportRecord): boolean {
  if (record.is_holiday) return true;
  if (record.leave_type) return true;
  if (leaveTypeToBalancePool(record.leave_type)) return true;
  if (record.raw_payload?.manual_leave || record.raw_payload?.manual_absent) {
    return true;
  }
  return false;
}

/**
 * Compares an existing monthly import with a new file preview before overwrite.
 */
export function computeImportReimportDiff(
  existing: ExistingImportRecord[],
  incoming: MatchedImportRow[],
): ImportReimportDiff {
  const existingByKey = new Map(
    existing.map((record) => [
      rowKey(record.external_employee_number, record.date),
      record,
    ]),
  );
  const incomingByKey = new Map(
    incoming.map((row) => [
      rowKey(row.externalEmployeeNumber, row.date),
      row,
    ]),
  );

  let newDays = 0;
  let removedDays = 0;
  let changedPunches = 0;
  let unchanged = 0;
  let manuallyEditedAtRisk = 0;

  for (const [key, row] of incomingByKey) {
    const prior = existingByKey.get(key);
    if (!prior) {
      newDays += 1;
      continue;
    }

    const nextIn = normalizeTime(row.firstCheckIn);
    const nextOut = normalizeTime(row.lastCheckOut);
    const priorIn = normalizeTime(prior.first_check_in);
    const priorOut = normalizeTime(prior.last_check_out);

    if (nextIn === priorIn && nextOut === priorOut) {
      unchanged += 1;
    } else {
      changedPunches += 1;
      if (isManuallyOverridden(prior) || isProtectedLeaveOrHoliday(prior)) {
        manuallyEditedAtRisk += 1;
      }
    }
  }

  for (const [key, prior] of existingByKey) {
    if (incomingByKey.has(key)) continue;
    removedDays += 1;
    // Leave/holiday-only days present in DB but missing from the new file.
    if (isManuallyOverridden(prior) || isProtectedLeaveOrHoliday(prior)) {
      manuallyEditedAtRisk += 1;
    }
  }

  return {
    existingRecordCount: existing.length,
    newRecordCount: incoming.length,
    newDays,
    removedDays,
    changedPunches,
    unchanged,
    manuallyEditedAtRisk,
  };
}
