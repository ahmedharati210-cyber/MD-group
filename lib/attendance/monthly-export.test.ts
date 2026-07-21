import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  buildAttendanceReport,
  buildEmployeeMonthFooterLines,
  REPORT_LABELS,
} from "@/lib/attendance/attendance-report";
import { buildMonthlyAttendanceWorkbook } from "@/lib/attendance/monthly-export";
import type {
  AttendanceBranch,
  AttendanceMonthlyRecord,
  AttendancePerson,
} from "@/types/db";

const branch: AttendanceBranch = {
  id: "b1",
  company_id: "c1",
  name: "الفرع",
  code: null,
  active: true,
  display_order: 0,
  full_time_threshold_minutes: 540,
  full_time_expected_minutes: 840,
  created_at: "2026-01-01T00:00:00Z",
};

const person: AttendancePerson = {
  id: "p1",
  company_id: "c1",
  branch_id: "b1",
  external_employee_number: "100",
  full_name: "موظف",
  active: true,
  first_seen_at: "2026-01-01T00:00:00Z",
  last_seen_at: "2026-06-01T00:00:00Z",
  notes: null,
  raw_department_hint: null,
  shift_id: null,
  custom_start_time: null,
  custom_end_time: null,
  custom_crosses_midnight: false,
  custom_late_grace_minutes: 15,
  custom_early_leave_grace_minutes: 15,
  custom_work_days: null,
  created_at: "2026-01-01T00:00:00Z",
};

function makeRecord(
  date: string,
  overrides: Partial<AttendanceMonthlyRecord> = {},
): AttendanceMonthlyRecord {
  return {
    id: `r-${date}`,
    import_id: "i1",
    company_id: "c1",
    branch_id: "b1",
    attendance_person_id: "p1",
    profile_id: null,
    external_employee_number: "100",
    employee_name: "موظف",
    date,
    first_check_in: "08:00",
    last_check_out: "17:00",
    total_minutes: 540,
    shift_type: "دوام كامل",
    expected_minutes: 480,
    late_minutes: 0,
    early_leave_minutes: 15,
    overtime_minutes: 0,
    deduction_minutes: 0,
    is_holiday: false,
    is_absent: false,
    leave_type: null,
    notes: null,
    raw_payload: null,
    shift_id: null,
    punch_count: 2,
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function buildFixtureReport() {
  return buildAttendanceReport({
    companyName: "شركة",
    branch,
    month: "2026-06-01",
    records: [makeRecord("2026-06-01")],
    people: [person],
  });
}

async function loadWorkbook(data: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  return workbook;
}

describe("buildMonthlyAttendanceWorkbook", () => {
  it("creates branch summary sheet as first worksheet", async () => {
    const report = buildFixtureReport();
    const buffer = await buildMonthlyAttendanceWorkbook(report);
    const workbook = await loadWorkbook(buffer);

    expect(workbook.worksheets[0]?.name).toBe(REPORT_LABELS.branchSummary);
    const headerRow = workbook.worksheets[0]?.getRow(4);
    expect(headerRow?.getCell(3).value).toBe(REPORT_LABELS.fullTimeDays);
    expect(headerRow?.getCell(8).value).toBe(REPORT_LABELS.earlyLeaveDays);
  });

  it("writes employee footer values from payroll row", async () => {
    const report = buildFixtureReport();
    const buffer = await buildMonthlyAttendanceWorkbook(report);
    const workbook = await loadWorkbook(buffer);

    const employeeSheet = workbook.worksheets.find((sheet) =>
      sheet.name.includes("100"),
    );
    expect(employeeSheet).toBeDefined();

    const payroll = report.employees[0].payroll;
    const footerLines = buildEmployeeMonthFooterLines(payroll);
    const summaryRow = 6 + 30 + 1;

    footerLines.forEach((line, index) => {
      expect(employeeSheet?.getCell(`B${summaryRow + index}`).value).toBe(line);
    });
  });
});
