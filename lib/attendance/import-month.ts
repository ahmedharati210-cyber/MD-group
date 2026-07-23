/** Client-safe helpers for attendance import month detection and defaults. */

import {
  DEFAULT_ATTENDANCE_MONTH_START_DAY,
  isDateInAttendancePeriod,
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

export function getDefaultAttendanceMonth(reference = new Date()): string {
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  if (monthIndex === 0) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return month;
  return `${ARABIC_MONTHS[monthIndex]} ${year}`;
}

export function detectDominantMonthFromDates(dates: string[]): string | null {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const month = date.slice(0, 7);
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

  const detectedMonth = detectDominantMonthFromDates(dates);
  return {
    detectedMonth: detectedMonth ?? selectedMonth,
    selectedMonth,
    message: `معظم تواريخ الملف خارج فترة الحضور (${period.label}). تحقق من الشهر المحدد أو بداية شهر الحضور للشركة.`,
  };
}
