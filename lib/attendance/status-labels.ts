/**
 * Client-safe attendance day status labels (unified across calendar, tables, payroll).
 */
import { hasOnePunch } from "@/lib/attendance/calendar-shared";
import {
  ABSENT_STATUS,
  hasLeave,
  recordLeaveLabel,
} from "@/lib/attendance/leave-types";
import { isPersonWorkDay } from "@/lib/attendance/person-schedule";
import type { AttendanceMonthlyRecord } from "@/types/db";

export type PersonDayStatus =
  | "leave"
  | "absent"
  | "onePunch"
  | "present"
  | "off";

export type PersonDayWorkContext = {
  date: string;
  workDays: number[] | null;
};

function isManualAbsent(record: AttendanceMonthlyRecord | null): boolean {
  return (
    (record?.raw_payload as Record<string, unknown> | null)?.manual_absent ===
    true
  );
}

/**
 * Classify a person's day.
 * When `workContext` is provided, non-work days are `"off"` (not absent)
 * unless marked `manual_absent`.
 */
export function classifyPersonDayStatus(
  record: AttendanceMonthlyRecord | null,
  workContext?: PersonDayWorkContext | null,
): PersonDayStatus {
  if (record && hasLeave(record)) return "leave";

  if (!record || record.is_absent) {
    if (
      workContext &&
      !isPersonWorkDay(workContext.date, workContext.workDays) &&
      !isManualAbsent(record)
    ) {
      return "off";
    }
    return "absent";
  }
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
    case "off":
      return "راحة";
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
    case "off":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
  }
}

export function recordStatusLabel(record: AttendanceMonthlyRecord): string {
  return personDayStatusLabel(
    classifyPersonDayStatus(record),
    recordLeaveLabel(record),
  );
}
