import type { PunchSession } from "@/lib/attendance/punch-sessions";
import { timeToMinutes } from "@/lib/attendance/punch-sessions";

export type RawPunchTime = { date: string; time: string };

export function parseAllPunchTimes(
  rawPayload: Record<string, unknown> | null | undefined,
): RawPunchTime[] {
  const payloadTimes = rawPayload?.all_punch_times;
  if (!Array.isArray(payloadTimes)) return [];

  const parsed: RawPunchTime[] = [];
  for (const punch of payloadTimes) {
    if (
      punch &&
      typeof punch === "object" &&
      "date" in punch &&
      "time" in punch &&
      typeof punch.date === "string" &&
      typeof punch.time === "string"
    ) {
      parsed.push({ date: punch.date, time: punch.time.slice(0, 5) });
    }
  }
  return parsed;
}

function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nmo = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nmo}-${nd}`;
}

export function inferLastPunchDate(
  shiftDate: string,
  firstCheckIn: string | null,
  lastCheckOut: string | null,
  fallback: string,
): string {
  if (!firstCheckIn || !lastCheckOut) return fallback;
  const inM = timeToMinutes(firstCheckIn);
  const outM = timeToMinutes(lastCheckOut);
  if (outM < inM) return addDays(shiftDate, 1);
  return shiftDate;
}

/**
 * Build a punch session from a stored monthly record, preferring raw_payload dates.
 */
export function punchSessionFromRecord(record: {
  date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  punch_count?: number | null;
  raw_payload?: Record<string, unknown> | null;
}): PunchSession | null {
  const firstCheckIn = record.first_check_in?.slice(0, 5) ?? null;
  const lastCheckOut = record.last_check_out?.slice(0, 5) ?? null;
  if (!firstCheckIn && !lastCheckOut) return null;

  const rawPayload = record.raw_payload ?? null;
  const allPunchTimes = parseAllPunchTimes(rawPayload);
  const firstPunchDate =
    (rawPayload?.first_punch_date as string | undefined) ?? record.date;
  const lastPunchDate =
    (rawPayload?.last_punch_date as string | undefined) ??
    inferLastPunchDate(record.date, firstCheckIn, lastCheckOut, record.date);

  return {
    shiftDate: record.date,
    firstCheckIn,
    lastCheckOut,
    firstPunchDate,
    lastPunchDate,
    punchCount:
      record.punch_count ??
      (typeof rawPayload?.punch_count === "number" ? rawPayload.punch_count : null) ??
      (allPunchTimes.length || (firstCheckIn && lastCheckOut ? 2 : 1)),
    allPunchTimes:
      allPunchTimes.length > 0
        ? allPunchTimes
        : [
            ...(firstCheckIn
              ? [{ date: firstPunchDate, time: firstCheckIn }]
              : []),
            ...(lastCheckOut
              ? [{ date: lastPunchDate, time: lastCheckOut }]
              : []),
          ],
  };
}

/**
 * Session for manual edits — uses edited times and marks overnight when needed.
 */
export function punchSessionFromManualEdit(
  shiftDate: string,
  firstCheckIn: string | null,
  lastCheckOut: string | null,
  existingPayload: Record<string, unknown> | null | undefined,
): PunchSession {
  const first = firstCheckIn?.slice(0, 5) ?? null;
  const last = lastCheckOut?.slice(0, 5) ?? null;
  const lastPunchDate = inferLastPunchDate(shiftDate, first, last, shiftDate);

  return {
    shiftDate,
    firstCheckIn: first,
    lastCheckOut: last,
    firstPunchDate: shiftDate,
    lastPunchDate,
    punchCount: 1,
    allPunchTimes: [
      ...(first ? [{ date: shiftDate, time: first }] : []),
      ...(last ? [{ date: lastPunchDate, time: last }] : []),
    ],
  };
}
