/**
 * Client-safe leave type constants for attendance day records.
 */
import { hasOnePunch } from "@/lib/attendance/calendar-shared";
import type { AttendanceMonthlyRecord } from "@/types/db";

export const LEAVE_TYPES = [
  "عطلة",
  "إجازة سنوية",
  "إجازة مرضية",
  "إجازة طارئة",
  "بدون أجر",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const HOLIDAY_LEAVE_TYPE: LeaveType = "عطلة";

/** UI value for manually marking a day as absent (not stored in leave_type). */
export const ABSENT_STATUS = "غياب" as const;

export const CREATE_DAY_STATUS_OPTIONS = [...LEAVE_TYPES, ABSENT_STATUS] as const;

export function isLeaveType(value: string | null | undefined): value is LeaveType {
  if (!value) return false;
  return (LEAVE_TYPES as readonly string[]).includes(value);
}

export function hasLeave(record: Pick<AttendanceMonthlyRecord, "leave_type">): boolean {
  return isLeaveType(record.leave_type);
}

export function recordLeaveLabel(
  record: Pick<AttendanceMonthlyRecord, "leave_type" | "is_holiday">,
): string | null {
  if (record.leave_type) return record.leave_type;
  if (record.is_holiday) return HOLIDAY_LEAVE_TYPE;
  return null;
}

export function formatAttendanceRecordNotes(
  record: Pick<
    AttendanceMonthlyRecord,
    | "notes"
    | "leave_type"
    | "is_holiday"
    | "is_absent"
    | "first_check_in"
    | "last_check_out"
    | "punch_count"
  >,
): string {
  if (record.notes) return record.notes;
  const leave = recordLeaveLabel(record);
  if (leave) return leave;
  if (record.is_absent) return "غياب";
  if (hasOnePunch(record as AttendanceMonthlyRecord)) return "بصمة واحدة";
  return "";
}
