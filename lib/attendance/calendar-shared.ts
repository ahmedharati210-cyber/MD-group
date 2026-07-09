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
  leaveLabel: string | null;
  records: AttendanceMonthlyRecord[];
};

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
