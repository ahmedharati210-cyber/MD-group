import "server-only";

import {
  buildBranchPayrollSummary,
  type BranchPayrollTotals,
  type PersonPayrollSummary,
} from "@/lib/attendance/attendance-view";
import { formatAttendanceRecordNotes } from "@/lib/attendance/leave-types";
import {
  enumerateMonthDays,
  formatMinutesAsHours,
  formatOvertimeDisplay,
  parseMonthParam,
} from "@/lib/attendance/monthly-calculations";
import type {
  AttendanceBranch,
  AttendanceMonthlyRecord,
  AttendancePerson,
} from "@/types/db";

export const EMPTY_CELL = "—";

/** Long-form weekday names for PDF/Excel exports (distinct from calendar-shared short labels). */
export const AR_DAY_NAMES_LONG = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

export function dayNameArLong(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return AR_DAY_NAMES_LONG[d.getDay()] ?? "";
}

export const REPORT_LABELS = {
  reportTitle: "تقرير الحضور الشهري",
  branchSummary: "ملخص الفرع",
  employeeDetails: "تفاصيل الموظفين",
  monthSummary: "ملخص الشهر",
  employee: "الموظف",
  employeeNumber: "#",
  fullTimeDays: "عدد ايام الدوام الكامل",
  absentDays: "غياب",
  onePunchDays: "بصمة واحدة",
  leaveDays: "إجازات",
  lateDays: "أيام التأخير",
  earlyLeaveDays: "عدد ايام الخروج المبكر",
  overtimeDays: "أيام الزيادة",
  workedHours: "ساعات العمل",
  expectedHours: "المطلوب",
  deductionHours: "الخصم",
  totalDeductionHours: "إجمالي الخصم",
  total: "الإجمالي",
  printDate: "تاريخ التقرير",
  daily: {
    index: "م",
    date: "التاريخ",
    weekday: "اليوم",
    checkIn: "أول تسجيل دخول",
    checkOut: "أخر تسجيل خروج",
    totalTime: "الوقت الإجمالي",
    shiftType: "نوع الدوام",
    expectedHours: "الساعات المطلوبة",
    overtimeDelta: "زيادة / نقص",
    lateMinutes: "دقائق التأخير",
    earlyLeaveMinutes: "خروج مبكر (د)",
    deductionHours: "ساعات الخصم",
    notes: "ملاحظات",
  },
} as const;

export const DAILY_COLUMN_HEADERS = [
  REPORT_LABELS.daily.index,
  REPORT_LABELS.daily.date,
  REPORT_LABELS.daily.weekday,
  REPORT_LABELS.daily.checkIn,
  REPORT_LABELS.daily.checkOut,
  REPORT_LABELS.daily.totalTime,
  REPORT_LABELS.daily.shiftType,
  REPORT_LABELS.daily.expectedHours,
  REPORT_LABELS.daily.overtimeDelta,
  REPORT_LABELS.daily.lateMinutes,
  REPORT_LABELS.daily.earlyLeaveMinutes,
  REPORT_LABELS.daily.deductionHours,
  REPORT_LABELS.daily.notes,
] as const;

export type DailyReportRow = {
  date: string;
  weekday: string;
  index: number;
  checkIn: string;
  checkOut: string;
  totalTime: string;
  shiftType: string;
  expectedHours: string;
  overtimeDelta: string;
  lateMinutes: string;
  earlyLeaveMinutes: string;
  deductionHours: string;
  notes: string;
};

export type EmployeeReportSection = {
  externalEmployeeNumber: string;
  employeeName: string;
  payroll: PersonPayrollSummary;
  days: DailyReportRow[];
};

export type AttendanceReportPayload = {
  meta: {
    companyName: string;
    branchName: string;
    month: string;
    monthLabel: string;
    printDate: string;
  };
  summary: {
    rows: PersonPayrollSummary[];
    totals: BranchPayrollTotals;
  };
  employees: EmployeeReportSection[];
};

export function timeOrEmpty(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function reportFileName(
  companyName: string,
  branchName: string,
  month: string,
): string {
  const [y, m] = month.slice(0, 7).split("-");
  return `تقرير الحضور - ${companyName} ${branchName} - ${m}-${y}`;
}

export function monthLabelAr(month: string): string {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return month;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return date.toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    timeZone: "Africa/Tripoli",
  });
}

export function formatReportHours(minutes: number): string {
  return formatMinutesAsHours(minutes);
}

function buildDailyReportRow(
  date: string,
  index: number,
  record: AttendanceMonthlyRecord | null,
): DailyReportRow {
  if (!record) {
    return {
      date,
      weekday: dayNameArLong(date),
      index,
      checkIn: EMPTY_CELL,
      checkOut: EMPTY_CELL,
      totalTime: EMPTY_CELL,
      shiftType: EMPTY_CELL,
      expectedHours: EMPTY_CELL,
      overtimeDelta: EMPTY_CELL,
      lateMinutes: EMPTY_CELL,
      earlyLeaveMinutes: EMPTY_CELL,
      deductionHours: EMPTY_CELL,
      notes: EMPTY_CELL,
    };
  }

  return {
    date,
    weekday: dayNameArLong(date),
    index,
    checkIn: timeOrEmpty(record.first_check_in) || EMPTY_CELL,
    checkOut: timeOrEmpty(record.last_check_out) || EMPTY_CELL,
    totalTime:
      record.total_minutes != null
        ? formatMinutesAsHours(record.total_minutes)
        : EMPTY_CELL,
    shiftType: record.shift_type ?? EMPTY_CELL,
    expectedHours:
      record.expected_minutes != null
        ? formatMinutesAsHours(record.expected_minutes)
        : EMPTY_CELL,
    overtimeDelta:
      formatOvertimeDisplay(record.total_minutes, record.expected_minutes) ||
      EMPTY_CELL,
    lateMinutes: record.late_minutes > 0 ? String(record.late_minutes) : EMPTY_CELL,
    earlyLeaveMinutes:
      record.early_leave_minutes > 0
        ? String(record.early_leave_minutes)
        : EMPTY_CELL,
    deductionHours:
      record.deduction_minutes > 0
        ? formatMinutesAsHours(record.deduction_minutes)
        : EMPTY_CELL,
    notes: formatAttendanceRecordNotes(record) || EMPTY_CELL,
  };
}

function groupRecordsByEmployeeNumber(
  records: AttendanceMonthlyRecord[],
): Map<string, Map<string, AttendanceMonthlyRecord>> {
  const map = new Map<string, Map<string, AttendanceMonthlyRecord>>();
  for (const record of records) {
    let byDate = map.get(record.external_employee_number);
    if (!byDate) {
      byDate = new Map();
      map.set(record.external_employee_number, byDate);
    }
    byDate.set(record.date, record);
  }
  return map;
}

export function buildEmployeeMonthFooterLines(
  payroll: PersonPayrollSummary,
): string[] {
  return [
    `${REPORT_LABELS.absentDays}: ${payroll.absentDays}`,
    `${REPORT_LABELS.onePunchDays}: ${payroll.onePunchDays}`,
    `${REPORT_LABELS.leaveDays}: ${payroll.leaveDays}`,
    `${REPORT_LABELS.lateDays}: ${payroll.lateDays}`,
    `${REPORT_LABELS.fullTimeDays}: ${payroll.fullTimeDays}`,
    `${REPORT_LABELS.earlyLeaveDays}: ${payroll.earlyLeaveDays}`,
    `${REPORT_LABELS.overtimeDays}: ${payroll.overtimeDays}`,
    `${REPORT_LABELS.totalDeductionHours}: ${formatReportHours(payroll.totalDeductionMinutes)}`,
  ];
}

export function buildAttendanceReport(options: {
  companyName: string;
  branch: AttendanceBranch;
  month: string;
  records: AttendanceMonthlyRecord[];
  people: AttendancePerson[];
}): AttendanceReportPayload {
  const parsed = parseMonthParam(options.month.slice(0, 7));
  if (!parsed) throw new Error("شهر غير صالح");

  const monthStr = options.month.slice(0, 7);
  const monthDays = enumerateMonthDays(parsed.year, parsed.month);
  const summary = buildBranchPayrollSummary(
    monthStr,
    options.records,
    options.people,
  );

  const payrollByEmployee = new Map(
    summary.rows.map((row) => [row.externalEmployeeNumber, row]),
  );

  const recordsByEmployee = groupRecordsByEmployeeNumber(options.records);

  const employeeMeta = new Map<
    string,
    { externalEmployeeNumber: string; employeeName: string }
  >();

  for (const person of options.people) {
    employeeMeta.set(person.external_employee_number, {
      externalEmployeeNumber: person.external_employee_number,
      employeeName: person.full_name,
    });
  }

  for (const row of summary.rows) {
    if (!employeeMeta.has(row.externalEmployeeNumber)) {
      employeeMeta.set(row.externalEmployeeNumber, {
        externalEmployeeNumber: row.externalEmployeeNumber,
        employeeName: row.employeeName,
      });
    }
  }

  const employees: EmployeeReportSection[] = Array.from(employeeMeta.values())
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ar"))
    .map((meta) => {
      const payroll = payrollByEmployee.get(meta.externalEmployeeNumber);
      if (!payroll) {
        throw new Error(
          `Missing payroll summary for employee ${meta.externalEmployeeNumber}`,
        );
      }

      const recordsByDate =
        recordsByEmployee.get(meta.externalEmployeeNumber) ?? new Map();

      return {
        externalEmployeeNumber: meta.externalEmployeeNumber,
        employeeName: meta.employeeName,
        payroll,
        days: monthDays.map((date, index) =>
          buildDailyReportRow(date, index + 1, recordsByDate.get(date) ?? null),
        ),
      };
    });

  const printDate = new Date().toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Tripoli",
  });

  return {
    meta: {
      companyName: options.companyName,
      branchName: options.branch.name,
      month: monthStr,
      monthLabel: monthLabelAr(options.month),
      printDate,
    },
    summary,
    employees,
  };
}
