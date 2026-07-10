import type { MatchedImportRow } from "@/lib/attendance/raw-excel-parser";

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
  manually_overridden?: boolean | null;
};

function rowKey(externalNumber: string, date: string): string {
  return `${externalNumber}|${date}`;
}

function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null;
  return time.slice(0, 5);
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
      if (prior.manually_overridden) manuallyEditedAtRisk += 1;
    }
  }

  for (const key of existingByKey.keys()) {
    if (!incomingByKey.has(key)) removedDays += 1;
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
