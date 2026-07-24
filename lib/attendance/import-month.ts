/** Client-safe helpers for attendance import month detection and defaults. */

import {
  DEFAULT_ATTENDANCE_MONTH_START_DAY,
  isDateInAttendancePeriod,
  resolveAttendanceLabelForDate,
  resolveAttendancePeriod,
} from "@/lib/attendance/attendance-period";

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

export type MonthMismatchInfo = {
  detectedMonth: string;
  selectedMonth: string;
  message: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function previousLabeledMonth(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum <= 1) return `${year - 1}-12`;
  return `${year}-${pad2(monthNum - 1)}`;
}

/**
 * Default import/view month: the labeled period before the one containing `reference`.
 * Honors company `attendance_month_start_day` so custom cycles (e.g. 28→27) pick the right label.
 */
export function getDefaultAttendanceMonth(
  reference = new Date(),
  startDay: number = DEFAULT_ATTENDANCE_MONTH_START_DAY,
): string {
  const iso = `${reference.getFullYear()}-${pad2(reference.getMonth() + 1)}-${pad2(reference.getDate())}`;
  const currentLabel = resolveAttendanceLabelForDate(iso, startDay);
  if (currentLabel) return previousLabeledMonth(currentLabel);

  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  if (monthIndex === 0) return `${year - 1}-12`;
  return `${year}-${pad2(monthIndex)}`;
}

export function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return month;
  return `${ARABIC_MONTHS[monthIndex]} ${year}`;
}

/**
 * Dominant labeled attendance month across punch dates (period-aware).
 */
export function detectDominantMonthFromDates(
  dates: string[],
  startDay: number = DEFAULT_ATTENDANCE_MONTH_START_DAY,
): string | null {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const month =
      resolveAttendanceLabelForDate(date, startDay) ?? date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let dominant: string | null = null;
  let max = 0;
  for (const [month, count] of counts) {
    if (count > max) {
      max = count;
      dominant = month;
    }
  }
  return dominant;
}

/**
 * Warn when most punch dates fall outside the company's resolved attendance period.
 */
export function detectImportMonthMismatch(
  selectedMonth: string,
  dates: string[],
  monthStartDay: number = DEFAULT_ATTENDANCE_MONTH_START_DAY,
): MonthMismatchInfo | null {
  if (dates.length === 0) return null;

  const period = resolveAttendancePeriod(selectedMonth, monthStartDay);
  if (!period) return null;

  const outside = dates.filter(
    (date) => !isDateInAttendancePeriod(date, period),
  );
  if (outside.length <= dates.length / 2) return null;

  const detectedMonth = detectDominantMonthFromDates(dates, monthStartDay);
  return {
    detectedMonth: detectedMonth ?? selectedMonth,
    selectedMonth,
    message: `معظم تواريخ الملف خارج فترة الحضور (${period.label}). تحقق من الشهر المحدد أو بداية شهر الحضور للشركة.`,
  };
}
