import "server-only";

import {
  enumerateMonthDays,
  formatMinutesAsHours,
  parseMonthParam,
} from "@/lib/attendance/monthly-calculations";
import { hasOnePunch, type DaySummary } from "@/lib/attendance/calendar-shared";
import { hasLeave, HOLIDAY_LEAVE_TYPE, recordLeaveLabel } from "@/lib/attendance/leave-types";
import {
  classifyPersonDayStatus,
  type PersonDayStatus,
} from "@/lib/attendance/status-labels";
import { isPersonWorkDay } from "@/lib/attendance/person-schedule";
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
  month: string,
  records: AttendanceMonthlyRecord[],
  people: AttendancePerson[] = [],
): MonthSummary {
  const calendarDays = buildCalendarDays(month, records, people);
  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let totalDeductionMinutes = 0;

  for (const day of calendarDays) {
    if (day.present > 0) presentDays += 1;
    if (day.absent > 0) absentDays += 1;
    if (day.late > 0) lateDays += 1;
  }
  for (const r of records) {
    totalDeductionMinutes += r.deduction_minutes;
  }

  const activePeople = people.filter((p) => p.active);

  return {
    totalPeople: activePeople.length || people.length,
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

function recordsByPersonAndDate(
  records: AttendanceMonthlyRecord[],
): Map<string, Map<string, AttendanceMonthlyRecord>> {
  const map = new Map<string, Map<string, AttendanceMonthlyRecord>>();
  for (const r of records) {
    if (!r.attendance_person_id) continue;
    const byDate = map.get(r.attendance_person_id) ?? new Map();
    byDate.set(r.date, r);
    map.set(r.attendance_person_id, byDate);
  }
  return map;
}

export function buildCalendarDays(
  month: string,
  records: AttendanceMonthlyRecord[],
  people: AttendancePerson[] = [],
): DaySummary[] {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return [];
  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byDate = groupRecordsByDate(records);
  const byPersonDate = recordsByPersonAndDate(records);
  const activePeople = people.filter((p) => p.active);
  const rosterIds = activePeople.map((p) => p.id);

  return days.map((date) => {
    const dayRecords = byDate.get(date) ?? [];
    let present = 0;
    let absent = 0;
    let late = 0;
    let missingPunch = 0;
    let leave = 0;

    const personIds = new Set<string>(rosterIds);
    for (const r of dayRecords) {
      if (r.attendance_person_id) personIds.add(r.attendance_person_id);
    }

    if (personIds.size === 0) {
      for (const r of dayRecords) {
        const status = classifyPersonDayStatus(r);
        if (status === "leave") leave += 1;
        else if (status === "absent") absent += 1;
        else if (status === "onePunch") missingPunch += 1;
        else present += 1;
        if (r.late_minutes > 0) late += 1;
      }
    } else {
      for (const personId of personIds) {
        const record = byPersonDate.get(personId)?.get(date) ?? null;
        const status = classifyPersonDayStatus(record);
        if (status === "leave") leave += 1;
        else if (status === "absent") absent += 1;
        else if (status === "onePunch") missingPunch += 1;
        else present += 1;
        if (record && record.late_minutes > 0) late += 1;
      }
    }

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

export type DayRosterEntry = {
  person: AttendancePerson | null;
  record: AttendanceMonthlyRecord | null;
  status: PersonDayStatus;
  leaveLabel: string | null;
};

/**
 * Roster-aware day breakdown: includes active people without a DB row as absent.
 */
export function buildDayRosterEntries(
  date: string,
  records: AttendanceMonthlyRecord[],
  people: AttendancePerson[],
): DayRosterEntry[] {
  const dayRecords = records.filter((record) => record.date === date);
  const byPersonDate = recordsByPersonAndDate(dayRecords);
  const rosterPeople = people.filter((person) => person.active);
  const seenPersonIds = new Set<string>();
  const entries: DayRosterEntry[] = [];

  for (const person of rosterPeople) {
    seenPersonIds.add(person.id);
    const record = byPersonDate.get(person.id)?.get(date) ?? null;
    entries.push({
      person,
      record,
      status: classifyPersonDayStatus(record),
      leaveLabel: record ? recordLeaveLabel(record) : null,
    });
  }

  for (const record of dayRecords) {
    const personId = record.attendance_person_id;
    if (personId && seenPersonIds.has(personId)) continue;

    const rosterPerson = personId
      ? people.find((person) => person.id === personId) ?? null
      : null;
    if (personId) seenPersonIds.add(personId);

    entries.push({
      person: rosterPerson,
      record,
      status: classifyPersonDayStatus(record),
      leaveLabel: recordLeaveLabel(record),
    });
  }

  entries.sort((a, b) => {
    const nameA = a.person?.full_name ?? a.record?.employee_name ?? "";
    const nameB = b.person?.full_name ?? b.record?.employee_name ?? "";
    return nameA.localeCompare(nameB, "ar");
  });
  return entries;
}

export function formatDeductionHours(minutes: number): string {
  return formatMinutesAsHours(minutes);
}

/**
 * Per-person calendar days: unlike buildCalendarDays (which only reflects days
 * that have a record row), a missing record counts as absent so
 * "didn't show up" days are always visible.
 * Non-work weekdays from the person's custom schedule are not counted absent.
 */
export function buildPersonCalendarDays(
  month: string,
  records: AttendanceMonthlyRecord[],
  workDays: number[] | null = null,
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
    } else if (!record) {
      if (isPersonWorkDay(date, workDays)) {
        absent = 1;
      }
    } else if (record.is_absent) {
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
  leaveDays: number;
  weekendDays: number;
  fullTimeDays: number;
  earlyLeaveDays: number;
  totalDeductionMinutes: number;
};

export function buildPersonMonthStats(
  month: string,
  records: AttendanceMonthlyRecord[],
  workDays: number[] | null = null,
): PersonMonthStats {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) {
    return {
      presentDays: 0,
      absentDays: 0,
      onePunchDays: 0,
      lateDays: 0,
      leaveDays: 0,
      weekendDays: 0,
      fullTimeDays: 0,
      earlyLeaveDays: 0,
      totalDeductionMinutes: 0,
    };
  }
  const days = enumerateMonthDays(parsed.year, parsed.month);
  const byDate = groupRecordsByDate(records);

  let presentDays = 0;
  let absentDays = 0;
  let onePunchDays = 0;
  let lateDays = 0;
  let leaveDays = 0;
  let weekendDays = 0;
  let fullTimeDays = 0;
  let earlyLeaveDays = 0;
  let totalDeductionMinutes = 0;

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
    if (!record) {
      if (isPersonWorkDay(date, workDays)) {
        absentDays += 1;
      }
      continue;
    }
    if (record.is_absent) {
      absentDays += 1;
      continue;
    }
    if (hasOnePunch(record)) onePunchDays += 1;
    else presentDays += 1;
    if (record.late_minutes > 0) lateDays += 1;
    if (record.early_leave_minutes > 0) earlyLeaveDays += 1;
    if (record.shift_type === "دوام كامل") fullTimeDays += 1;
    // One-punch late days are counted above, but never contribute deducted time.
    if (!hasOnePunch(record)) {
      totalDeductionMinutes += record.deduction_minutes;
    }
  }

  return {
    presentDays,
    absentDays,
    onePunchDays,
    lateDays,
    leaveDays,
    weekendDays,
    fullTimeDays,
    earlyLeaveDays,
    totalDeductionMinutes,
  };
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
      if (!record) {
        if (isPersonWorkDay(date, person?.custom_work_days ?? null)) {
          row.absentDays += 1;
        }
        continue;
      }
      if (record.is_absent) {
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
      // One-punch late is a day flag only — do not accumulate late/deduction minutes.
      if (!hasOnePunch(record)) {
        row.totalLateMinutes += record.late_minutes;
        row.totalEarlyLeaveMinutes += record.early_leave_minutes;
        row.totalOvertimeMinutes += record.overtime_minutes;
        row.totalDeductionMinutes += record.deduction_minutes;
      }
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
