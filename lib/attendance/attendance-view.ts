import "server-only";

import {
  enumerateMonthDays,
  formatMinutesAsHours,
  parseMonthParam,
} from "@/lib/attendance/monthly-calculations";
import { hasOnePunch, type DaySummary } from "@/lib/attendance/calendar-shared";
import { hasLeave, HOLIDAY_LEAVE_TYPE, recordLeaveLabel } from "@/lib/attendance/leave-types";
import type { AttendanceMonthlyRecord, AttendancePerson } from "@/types/db";

export type { DaySummary } from "@/lib/attendance/calendar-shared";

export type MonthSummary = {
  totalPeople: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalDeductionMinutes: number;
};

export function buildMonthSummary(
  records: AttendanceMonthlyRecord[],
  peopleCount: number,
): MonthSummary {
  const byDate = groupRecordsByDate(records);
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let totalDeductionMinutes = 0;

  for (const dayRecords of byDate.values()) {
    const hasAbsent = dayRecords.some((r) => r.is_absent);
    const hasPresent = dayRecords.some(
      (r) => !r.is_absent && (r.first_check_in || r.last_check_out),
    );
    const hasLate = dayRecords.some((r) => r.late_minutes > 0);
    if (hasAbsent) absentDays += 1;
    if (hasPresent) presentDays += 1;
    if (hasLate) lateDays += 1;
    for (const r of dayRecords) {
      totalDeductionMinutes += r.deduction_minutes;
    }
  }

  return {
    totalPeople: peopleCount,
    presentDays,
    absentDays,
    lateDays,
    totalDeductionMinutes,
  };
}

export function groupRecordsByDate(
  records: AttendanceMonthlyRecord[],
): Map<string, AttendanceMonthlyRecord[]> {
  const map = new Map<string, AttendanceMonthlyRecord[]>();
  for (const r of records) {
    const list = map.get(r.date) ?? [];
    list.push(r);
    map.set(r.date, list);
  }
  return map;
}

export function groupRecordsByPerson(
  records: AttendanceMonthlyRecord[],
): Map<string, AttendanceMonthlyRecord[]> {
  const map = new Map<string, AttendanceMonthlyRecord[]>();
  for (const r of records) {
    const key = r.attendance_person_id ?? r.external_employee_number;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

export function buildCalendarDays(
  month: string,
  records: AttendanceMonthlyRecord[],
): DaySummary[] {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return [];
  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byDate = groupRecordsByDate(records);

  return days.map((date) => {
    const dayRecords = byDate.get(date) ?? [];
    let present = 0;
    let absent = 0;
    let late = 0;
    let missingPunch = 0;
    for (const r of dayRecords) {
      if (hasLeave(r)) continue;
      if (r.is_absent) absent += 1;
      else if (!r.first_check_in || !r.last_check_out) missingPunch += 1;
      else present += 1;
      if (r.late_minutes > 0) late += 1;
    }
    const leave = dayRecords.filter((r) => hasLeave(r)).length;
    const leaveLabel =
      dayRecords.length === 1 ? recordLeaveLabel(dayRecords[0]) : null;
    return {
      date,
      present,
      absent,
      late,
      missingPunch,
      leave,
      leaveLabel,
      records: dayRecords,
    };
  });
}

export function personRecordCounts(
  people: AttendancePerson[],
  records: AttendanceMonthlyRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of people) counts.set(p.id, 0);
  for (const r of records) {
    if (r.attendance_person_id) {
      counts.set(
        r.attendance_person_id,
        (counts.get(r.attendance_person_id) ?? 0) + 1,
      );
    }
  }
  return counts;
}

export function formatDeductionHours(minutes: number): string {
  return formatMinutesAsHours(minutes);
}

/**
 * Per-person calendar days: unlike buildCalendarDays (which only reflects days
 * that have a record row), a missing record counts as absent so
 * "didn't show up" days are always visible.
 */
export function buildPersonCalendarDays(
  month: string,
  records: AttendanceMonthlyRecord[],
): DaySummary[] {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return [];
  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byDate = groupRecordsByDate(records);

  return days.map((date) => {
    const dayRecords = byDate.get(date) ?? [];
    const record = dayRecords[0] ?? null;
    let present = 0;
    let absent = 0;
    let late = 0;
    let missingPunch = 0;

    let leave = 0;
    let leaveLabel: string | null = null;

    if (record && hasLeave(record)) {
      leave = 1;
      leaveLabel = recordLeaveLabel(record);
    } else if (!record || record.is_absent) {
      absent = 1;
    } else if (hasOnePunch(record)) {
      missingPunch = 1;
    } else {
      present = 1;
    }
    if (record && record.late_minutes > 0) late = 1;

    return {
      date,
      present,
      absent,
      late,
      missingPunch,
      leave,
      leaveLabel,
      records: dayRecords,
    };
  });
}

export type PersonMonthStats = {
  presentDays: number;
  absentDays: number;
  onePunchDays: number;
  lateDays: number;
  weekendDays: number;
  leaveDays: number;
};

export function buildPersonMonthStats(
  month: string,
  records: AttendanceMonthlyRecord[],
): PersonMonthStats {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) {
    return {
      presentDays: 0,
      absentDays: 0,
      onePunchDays: 0,
      lateDays: 0,
      weekendDays: 0,
      leaveDays: 0,
    };
  }
  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byDate = groupRecordsByDate(records);

  let presentDays = 0;
  let absentDays = 0;
  let onePunchDays = 0;
  let lateDays = 0;
  let weekendDays = 0;

  let leaveDays = 0;

  for (const date of days) {
    const record = (byDate.get(date) ?? [])[0] ?? null;
    if (record?.leave_type === HOLIDAY_LEAVE_TYPE) {
      weekendDays += 1;
      continue;
    }
    if (record && hasLeave(record)) {
      leaveDays += 1;
      continue;
    }
    if (!record || record.is_absent) {
      absentDays += 1;
      continue;
    }
    if (hasOnePunch(record)) onePunchDays += 1;
    else presentDays += 1;
    if (record.late_minutes > 0) lateDays += 1;
  }

  return { presentDays, absentDays, onePunchDays, lateDays, weekendDays, leaveDays };
}

export type PersonPayrollSummary = {
  personId: string | null;
  externalEmployeeNumber: string;
  employeeName: string;
  presentDays: number;
  absentDays: number;
  onePunchDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  overtimeDays: number;
  fullTimeDays: number;
  leaveDays: number;
  totalWorkedMinutes: number;
  totalExpectedMinutes: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  totalOvertimeMinutes: number;
  totalDeductionMinutes: number;
};

export type BranchPayrollTotals = Omit<
  PersonPayrollSummary,
  "personId" | "externalEmployeeNumber" | "employeeName"
>;

function emptyPayrollCounters(): BranchPayrollTotals {
  return {
    presentDays: 0,
    absentDays: 0,
    onePunchDays: 0,
    lateDays: 0,
    earlyLeaveDays: 0,
    overtimeDays: 0,
    fullTimeDays: 0,
    leaveDays: 0,
    totalWorkedMinutes: 0,
    totalExpectedMinutes: 0,
    totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    totalOvertimeMinutes: 0,
    totalDeductionMinutes: 0,
  };
}

export function buildBranchPayrollSummary(
  month: string,
  records: AttendanceMonthlyRecord[],
  people: AttendancePerson[],
): { rows: PersonPayrollSummary[]; totals: BranchPayrollTotals } {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) {
    return { rows: [], totals: emptyPayrollCounters() };
  }

  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byPerson = groupRecordsByPerson(records);
  const peopleByKey = new Map<string, AttendancePerson>();
  for (const person of people) {
    peopleByKey.set(person.id, person);
  }

  const personKeys = new Set<string>();
  for (const person of people) personKeys.add(person.id);
  for (const r of records) {
    personKeys.add(r.attendance_person_id ?? r.external_employee_number);
  }

  const rows: PersonPayrollSummary[] = [];

  for (const key of personKeys) {
    const personRecords = byPerson.get(key) ?? [];
    const person = peopleByKey.get(key) ?? null;
    const byDate = groupRecordsByDate(personRecords);

    const row: PersonPayrollSummary = {
      personId: person?.id ?? personRecords[0]?.attendance_person_id ?? null,
      externalEmployeeNumber:
        person?.external_employee_number ??
        personRecords[0]?.external_employee_number ??
        key,
      employeeName:
        person?.full_name ?? personRecords[0]?.employee_name ?? "غير معروف",
      ...emptyPayrollCounters(),
    };

    for (const date of days) {
      const record = (byDate.get(date) ?? [])[0] ?? null;
      if (record?.leave_type === HOLIDAY_LEAVE_TYPE) {
        continue;
      }
      if (record && hasLeave(record)) {
        row.leaveDays += 1;
        continue;
      }
      if (!record || record.is_absent) {
        row.absentDays += 1;
        continue;
      }
      if (hasOnePunch(record)) {
        row.onePunchDays += 1;
      } else {
        row.presentDays += 1;
      }
      if (record.late_minutes > 0) row.lateDays += 1;
      if (record.early_leave_minutes > 0) row.earlyLeaveDays += 1;
      if (record.overtime_minutes > 0) row.overtimeDays += 1;
      if (record.shift_type === "دوام كامل") row.fullTimeDays += 1;

      row.totalWorkedMinutes += record.total_minutes ?? 0;
      row.totalExpectedMinutes += record.expected_minutes ?? 0;
      row.totalLateMinutes += record.late_minutes;
      row.totalEarlyLeaveMinutes += record.early_leave_minutes;
      row.totalOvertimeMinutes += record.overtime_minutes;
      row.totalDeductionMinutes += record.deduction_minutes;
    }

    rows.push(row);
  }

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ar"));

  const totals = emptyPayrollCounters();
  for (const row of rows) {
    totals.presentDays += row.presentDays;
    totals.absentDays += row.absentDays;
    totals.onePunchDays += row.onePunchDays;
    totals.lateDays += row.lateDays;
    totals.earlyLeaveDays += row.earlyLeaveDays;
    totals.overtimeDays += row.overtimeDays;
    totals.fullTimeDays += row.fullTimeDays;
    totals.leaveDays += row.leaveDays;
    totals.totalWorkedMinutes += row.totalWorkedMinutes;
    totals.totalExpectedMinutes += row.totalExpectedMinutes;
    totals.totalLateMinutes += row.totalLateMinutes;
    totals.totalEarlyLeaveMinutes += row.totalEarlyLeaveMinutes;
    totals.totalOvertimeMinutes += row.totalOvertimeMinutes;
    totals.totalDeductionMinutes += row.totalDeductionMinutes;
  }

  return { rows, totals };
}
