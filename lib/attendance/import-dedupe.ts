import "server-only";

import type { PunchSession } from "@/lib/attendance/punch-sessions";
import {
  computeSessionRecord,
  DEFAULT_FULL_TIME_CONFIG,
  type FullTimeConfig,
} from "@/lib/attendance/shift-matching";
import type { MatchedImportRow } from "@/lib/attendance/raw-excel-parser";
import type { AttendanceShift } from "@/types/db";

function punchTimestamp(date: string, time: string | null): number {
  if (!time) return 0;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

function rowStartTs(row: MatchedImportRow): number {
  const firstDate =
    (row.rawPayload?.first_punch_date as string | undefined) ?? row.date;
  return punchTimestamp(firstDate, row.firstCheckIn);
}

function rowEndTs(row: MatchedImportRow): number {
  const lastDate =
    (row.rawPayload?.last_punch_date as string | undefined) ?? row.date;
  return punchTimestamp(lastDate, row.lastCheckOut);
}

/**
 * Safety net: collapse duplicate (employee, date) rows before DB insert.
 */
export function dedupeMatchedImportRows(
  rows: MatchedImportRow[],
  shifts: AttendanceShift[] = [],
  fullTimeConfig: FullTimeConfig = DEFAULT_FULL_TIME_CONFIG,
): MatchedImportRow[] {
  const byKey = new Map<string, MatchedImportRow[]>();

  for (const row of rows) {
    const key = `${row.externalEmployeeNumber}|${row.date}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const deduped: MatchedImportRow[] = [];

  for (const group of byKey.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }

    let earliest = group[0];
    let latest = group[0];
    let earliestTs = rowStartTs(earliest);
    let latestTs = rowEndTs(latest);
    let punchCount = earliest.punchCount ?? 0;
    const allPunchTimes: Array<{ date: string; time: string }> = [];

    for (const row of group) {
      punchCount += row.punchCount ?? 0;
      const payloadTimes = row.rawPayload?.all_punch_times;
      if (Array.isArray(payloadTimes)) {
        for (const punch of payloadTimes) {
          if (
            punch &&
            typeof punch === "object" &&
            "date" in punch &&
            "time" in punch &&
            typeof punch.date === "string" &&
            typeof punch.time === "string"
          ) {
            allPunchTimes.push({ date: punch.date, time: punch.time });
          }
        }
      }

      const startTs = rowStartTs(row);
      if (startTs < earliestTs) {
        earliestTs = startTs;
        earliest = row;
      }

      const endTs = rowEndTs(row);
      if (endTs > latestTs) {
        latestTs = endTs;
        latest = row;
      }
    }

    const firstDate =
      (earliest.rawPayload?.first_punch_date as string | undefined) ?? earliest.date;
    const lastDate =
      (latest.rawPayload?.last_punch_date as string | undefined) ?? latest.date;

    const sortedPunchTimes =
      allPunchTimes.length > 0
        ? allPunchTimes.sort(
            (a, b) => punchTimestamp(a.date, a.time) - punchTimestamp(b.date, b.time),
          )
        : [
            ...(earliest.firstCheckIn
              ? [{ date: firstDate, time: earliest.firstCheckIn }]
              : []),
            ...(latest.lastCheckOut
              ? [{ date: lastDate, time: latest.lastCheckOut }]
              : []),
          ];

    const session: PunchSession = {
      shiftDate: earliest.date,
      firstCheckIn: earliest.firstCheckIn,
      lastCheckOut: latest.lastCheckOut,
      firstPunchDate: firstDate,
      lastPunchDate: lastDate,
      punchCount: punchCount || sortedPunchTimes.length || 1,
      allPunchTimes: sortedPunchTimes,
    };

    const { computed, shift } = computeSessionRecord(session, shifts, fullTimeConfig);

    deduped.push({
      ...group[0],
      firstCheckIn: earliest.firstCheckIn,
      lastCheckOut: latest.lastCheckOut,
      computed,
      totalMinutes: computed.totalMinutes,
      shiftId: shift?.id ?? group[0].shiftId ?? null,
      punchCount: punchCount || null,
      rawPayload: {
        ...group[0].rawPayload,
        punch_count: punchCount || null,
        first_punch_date: firstDate,
        last_punch_date: lastDate,
        all_punch_times:
          allPunchTimes.length > 0
            ? sortedPunchTimes
            : group[0].rawPayload?.all_punch_times,
        merged_duplicate_rows: group.length,
      },
    });
  }

  return deduped.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return a.externalEmployeeNumber.localeCompare(b.externalEmployeeNumber);
  });
}
