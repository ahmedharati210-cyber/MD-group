/**
 * Client-safe attendance day status labels (unified across calendar, tables, payroll).
 */
import { hasOnePunch } from "@/lib/attendance/calendar-shared";
import {
  ABSENT_STATUS,
  hasLeave,
  recordLeaveLabel,
} from "@/lib/attendance/leave-types";
import type { AttendanceMonthlyRecord } from "@/types/db";

export type PersonDayStatus = "leave" | "absent" | "onePunch" | "present";

export function classifyPersonDayStatus(
  record: AttendanceMonthlyRecord | null,
): PersonDayStatus {
  if (record && hasLeave(record)) return "leave";
  if (!record || record.is_absent) return "absent";
  if (hasOnePunch(record)) return "onePunch";
  return "present";
}

export function personDayStatusLabel(
  status: PersonDayStatus,
  leaveLabel?: string | null,
): string {
  switch (status) {
    case "leave":
      return leaveLabel ?? "إجازة";
    case "absent":
      return ABSENT_STATUS;
    case "onePunch":
      return "بصمة واحدة";
    case "present":
      return "حاضر";
  }
}

export function personDayStatusBadgeClass(status: PersonDayStatus): string {
  switch (status) {
    case "leave":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200";
    case "onePunch":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    case "absent":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200";
    case "present":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
  }
}

export function recordStatusLabel(record: AttendanceMonthlyRecord): string {
  return personDayStatusLabel(
    classifyPersonDayStatus(record),
    recordLeaveLabel(record),
  );
}
