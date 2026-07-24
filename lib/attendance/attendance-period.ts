/**
 * Client-safe attendance period helpers (custom company month start day).
 */

export const ATTENDANCE_MONTH_START_DAY_MIN = 1;
export const ATTENDANCE_MONTH_START_DAY_MAX = 31;
export const DEFAULT_ATTENDANCE_MONTH_START_DAY = 1;

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export type AttendancePeriod = {
  /** Labeled month YYYY-MM */
  month: string;
  startDay: number;
  startDate: string;
  endDate: string;
  days: string[];
  /** Arabic human label for the inclusive date range */
  label: string;
};

function parseMonthParam(value: string): { year: number; month: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function normalizeAttendanceMonthStartDay(
  value: number | null | undefined,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ATTENDANCE_MONTH_START_DAY;
  const day = Math.trunc(n);
  if (day < ATTENDANCE_MONTH_START_DAY_MIN) {
    return ATTENDANCE_MONTH_START_DAY_MIN;
  }
  if (day > ATTENDANCE_MONTH_START_DAY_MAX) {
    return ATTENDANCE_MONTH_START_DAY_MAX;
  }
  return day;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addCalendarMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInCalendarMonth(year, month));
}

function addDaysIso(date: string, days: number): string {
  const cursor = new Date(`${date}T12:00:00`);
  cursor.setDate(cursor.getDate() + days);
  return formatIsoDate(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    cursor.getDate(),
  );
}

function enumerateInclusiveDates(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const d = cursor.getDate();
    days.push(formatIsoDate(y, m, d));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatAttendancePeriodLabel(
  startDate: string,
  endDate: string,
): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} – ${endDate}`;
  }
  const startLabel = `${start.getDate()} ${ARABIC_MONTHS[start.getMonth()]}`;
  const endLabel = `${end.getDate()} ${ARABIC_MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startLabel} ${start.getFullYear()} – ${endLabel}`;
  }
  return `${startLabel} – ${endLabel}`;
}

/**
 * Resolve the attendance period for a labeled month (YYYY-MM).
 * startDay 1 → calendar month; otherwise previous-month-startDay through labeled-(startDay-1).
 */
export function resolveAttendancePeriod(
  month: string,
  startDay: number = DEFAULT_ATTENDANCE_MONTH_START_DAY,
): AttendancePeriod | null {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return null;

  const day = normalizeAttendanceMonthStartDay(startDay);
  const { year, month: labeledMonth } = parsed;

  let startDate: string;
  let endDate: string;

  if (day === 1) {
    startDate = formatIsoDate(year, labeledMonth, 1);
    endDate = formatIsoDate(
      year,
      labeledMonth,
      daysInCalendarMonth(year, labeledMonth),
    );
  } else {
    // Start = clamp(prev-month, startDay). End = day before next period's start
    // so adjacent periods stay disjoint when short months clamp (e.g. start 31 in Feb).
    const prev = addCalendarMonths(year, labeledMonth, -1);
    startDate = formatIsoDate(
      prev.year,
      prev.month,
      clampDay(prev.year, prev.month, day),
    );
    const nextPeriodStart = formatIsoDate(
      year,
      labeledMonth,
      clampDay(year, labeledMonth, day),
    );
    endDate = addDaysIso(nextPeriodStart, -1);
    if (endDate < startDate) {
      endDate = startDate;
    }
  }

  const days = enumerateInclusiveDates(startDate, endDate);
  return {
    month: `${year}-${pad2(labeledMonth)}`,
    startDay: day,
    startDate,
    endDate,
    days,
    label: formatAttendancePeriodLabel(startDate, endDate),
  };
}

export function isDateInAttendancePeriod(
  date: string,
  period: Pick<AttendancePeriod, "startDate" | "endDate">,
): boolean {
  return date >= period.startDate && date <= period.endDate;
}

/**
 * Map a calendar date (YYYY-MM-DD) to the labeled attendance month (YYYY-MM)
 * that contains it for the given company month-start day.
 *
 * When startDay is 1 this is just the date's calendar month.
 * When startDay is e.g. 28, dates like 2026-05-29 belong to labeled 2026-06.
 */
export function resolveAttendanceLabelForDate(
  date: string,
  startDay: number = DEFAULT_ATTENDANCE_MONTH_START_DAY,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const day = normalizeAttendanceMonthStartDay(startDay);
  const dateMonth = date.slice(0, 7);
  if (day === 1) return parseMonthParam(dateMonth) ? dateMonth : null;

  const parsed = parseMonthParam(dateMonth);
  if (!parsed) return null;

  const samePeriod = resolveAttendancePeriod(dateMonth, day);
  if (samePeriod && isDateInAttendancePeriod(date, samePeriod)) {
    return samePeriod.month;
  }

  const next = addCalendarMonths(parsed.year, parsed.month, 1);
  const nextLabel = `${next.year}-${pad2(next.month)}`;
  const nextPeriod = resolveAttendancePeriod(nextLabel, day);
  if (nextPeriod && isDateInAttendancePeriod(date, nextPeriod)) {
    return nextPeriod.month;
  }

  return dateMonth;
}
