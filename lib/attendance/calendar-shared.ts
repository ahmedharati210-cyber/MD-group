/**
 * Client-safe attendance calendar types/helpers. Does NOT import "server-only"
 * so it can be used from both server code and client components
 * (e.g. attendance-calendar.tsx).
 */
import type { AttendanceMonthlyRecord } from "@/types/db";

export type DaySummary = {
  date: string;
  present: number;
  absent: number;
  late: number;
  missingPunch: number;
  leave: number;
  /** People on a scheduled non-work day (rest / off). */
  off: number;
  leaveLabel: string | null;
  records: AttendanceMonthlyRecord[];
};

/** Arabic weekday labels (Sunday = index 0), aligned with attendance-calendar. */
export const AR_WEEKDAY_LABELS = [
  "أحد",
  "إثنين",
  "ثلاثاء",
  "أربعاء",
  "خميس",
  "جمعة",
  "سبت",
] as const;

/** Single-letter weekday headers for narrow calendar cells. */
export const AR_WEEKDAY_SHORT_LABELS = [
  "ح",
  "ن",
  "ث",
  "ر",
  "خ",
  "ج",
  "س",
] as const;

export function weekdayLabelAr(date: string): string {
  return AR_WEEKDAY_LABELS[new Date(`${date}T12:00:00`).getDay()];
}

/** Fridays are treated as the weekly weekend across the attendance UI. */
export function isFriday(date: string): boolean {
  return new Date(`${date}T12:00:00`).getDay() === 5;
}

export function hasOnePunch(record: AttendanceMonthlyRecord): boolean {
  if (record.punch_count === 1) return true;
  if (
    record.first_check_in &&
    record.last_check_out &&
    record.first_check_in === record.last_check_out
  ) {
    return true;
  }
  return Boolean(record.first_check_in) !== Boolean(record.last_check_out);
}
