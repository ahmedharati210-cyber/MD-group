/**
 * Client-safe person metric drill-down helpers for attendance summary cards.
 */
import { hasOnePunch, weekdayLabelAr } from "@/lib/attendance/calendar-shared";
import {
  HOLIDAY_LEAVE_TYPE,
  hasLeave,
  recordLeaveLabel,
} from "@/lib/attendance/leave-types";
import type { AttendanceMonthlyRecord } from "@/types/db";

export type PersonMetricKey =
  | "fullTimeDays"
  | "absentDays"
  | "onePunchDays"
  | "lateDays"
  | "earlyLeaveDays"
  | "totalDeductionMinutes";

export type PersonMetricDayRow = {
  date: string;
  weekday: string;
  checkIn: string;
  checkOut: string;
  detailLabel: string;
  detailValue: string;
  statusLabel: string;
};

const EMPTY = "—";

const METRIC_TITLES: Record<PersonMetricKey, string> = {
  fullTimeDays: "عدد ايام الدوام الكامل",
  absentDays: "غياب",
  onePunchDays: "بصمة واحدة",
  lateDays: "أيام تأخير",
  earlyLeaveDays: "عدد ايام الخروج المبكر",
  totalDeductionMinutes: "ساعات الخصم",
};

export function metricTitleAr(metric: PersonMetricKey): string {
  return METRIC_TITLES[metric];
}

function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatDeductionHours(minutes: number): string {
  return formatMinutesAsHours(minutes);
}

function parseMonthParam(value: string): { year: number; month: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function enumerateMonthDays(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${prefix}-${day}`;
  });
}

function timeOrEmpty(value: string | null): string {
  if (!value) return EMPTY;
  return value.slice(0, 5);
}

function groupRecordsByDate(
  records: AttendanceMonthlyRecord[],
): Map<string, AttendanceMonthlyRecord> {
  const map = new Map<string, AttendanceMonthlyRecord>();
  for (const record of records) {
    map.set(record.date, record);
  }
  return map;
}

function statusLabelForRecord(record: AttendanceMonthlyRecord | null): string {
  if (!record) return "غياب";
  if (hasLeave(record)) return recordLeaveLabel(record) ?? "إجازة";
  if (record.is_absent) return "غياب";
  if (hasOnePunch(record)) return "بصمة واحدة";
  return "حاضر";
}

function matchesMetric(
  record: AttendanceMonthlyRecord | null,
  metric: PersonMetricKey,
): boolean {
  if (record?.leave_type === HOLIDAY_LEAVE_TYPE) return false;
  if (record && hasLeave(record)) return false;

  switch (metric) {
    case "fullTimeDays":
      return record?.shift_type === "دوام كامل";
    case "absentDays":
      return !record || record.is_absent;
    case "onePunchDays":
      return Boolean(record && hasOnePunch(record));
    case "lateDays":
      return Boolean(record && record.late_minutes > 0);
    case "earlyLeaveDays":
      return Boolean(record && record.early_leave_minutes > 0);
    case "totalDeductionMinutes":
      return Boolean(record && record.deduction_minutes > 0);
  }
}

function detailForMetric(
  record: AttendanceMonthlyRecord | null,
  metric: PersonMetricKey,
): { detailLabel: string; detailValue: string } {
  switch (metric) {
    case "fullTimeDays":
      return {
        detailLabel: "نوع الدوام",
        detailValue: record?.shift_type ?? EMPTY,
      };
    case "absentDays":
      return { detailLabel: "الحالة", detailValue: statusLabelForRecord(record) };
    case "onePunchDays":
      return {
        detailLabel: "عدد البصمات",
        detailValue: record?.punch_count != null ? String(record.punch_count) : EMPTY,
      };
    case "lateDays":
      if (record && hasOnePunch(record) && record.late_minutes > 0) {
        return { detailLabel: "التأخير", detailValue: "يوم تأخير" };
      }
      return {
        detailLabel: "دقائق التأخير",
        detailValue:
          record && record.late_minutes > 0 ? `${record.late_minutes} د` : EMPTY,
      };
    case "earlyLeaveDays":
      return {
        detailLabel: "دقائق الخروج المبكر",
        detailValue:
          record && record.early_leave_minutes > 0
            ? `${record.early_leave_minutes} د`
            : EMPTY,
      };
    case "totalDeductionMinutes":
      return {
        detailLabel: "ساعات الخصم",
        detailValue:
          record && record.deduction_minutes > 0
            ? formatMinutesAsHours(record.deduction_minutes)
            : EMPTY,
      };
  }
}

export function filterPersonMetricDays(
  month: string,
  records: AttendanceMonthlyRecord[],
  metric: PersonMetricKey,
): PersonMetricDayRow[] {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return [];

  const byDate = groupRecordsByDate(records);
  const rows: PersonMetricDayRow[] = [];

  for (const date of enumerateMonthDays(parsed.year, parsed.month)) {
    const record = byDate.get(date) ?? null;
    if (!matchesMetric(record, metric)) continue;

    const { detailLabel, detailValue } = detailForMetric(record, metric);
    rows.push({
      date,
      weekday: weekdayLabelAr(date),
      checkIn: timeOrEmpty(record?.first_check_in ?? null),
      checkOut: timeOrEmpty(record?.last_check_out ?? null),
      detailLabel,
      detailValue,
      statusLabel: statusLabelForRecord(record),
    });
  }

  return rows;
}
