import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildAttendanceReport,
  buildEmployeeMonthFooterLines,
  EMPTY_CELL,
  REPORT_LABELS,
} from "@/lib/attendance/attendance-report";
import { buildAttendanceReportHtml } from "@/lib/attendance/attendance-pdf";
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

const personWithRecords: AttendancePerson = {
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
  created_at: "2026-01-01T00:00:00Z",
};

const personNoRecords: AttendancePerson = {
  id: "p2",
  company_id: "c1",
  branch_id: "b1",
  external_employee_number: "200",
  full_name: "بدون سجلات",
  active: true,
  first_seen_at: "2026-01-01T00:00:00Z",
  last_seen_at: "2026-06-01T00:00:00Z",
  notes: null,
  raw_department_hint: null,
  shift_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

function makeRecord(
  overrides: Partial<AttendanceMonthlyRecord> & Pick<AttendanceMonthlyRecord, "date">,
): AttendanceMonthlyRecord {
  return {
    id: "r1",
    import_id: "i1",
    company_id: "c1",
    branch_id: "b1",
    attendance_person_id: "p1",
    profile_id: null,
    external_employee_number: "100",
    employee_name: "موظف",
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

describe("buildAttendanceReport", () => {
  it("includes all roster employees including those with zero records", () => {
    const payload = buildAttendanceReport({
      companyName: "شركة",
      branch,
      month: "2026-06-01",
      records: [makeRecord({ date: "2026-06-01" })],
      people: [personWithRecords, personNoRecords],
    });

    expect(payload.summary.rows).toHaveLength(2);
    expect(payload.employees).toHaveLength(2);
    expect(payload.employees.map((e) => e.externalEmployeeNumber)).toEqual([
      "200",
      "100",
    ]);
  });

  it("builds 30 daily rows for June with empty-day placeholder", () => {
    const payload = buildAttendanceReport({
      companyName: "شركة",
      branch,
      month: "2026-06-01",
      records: [makeRecord({ date: "2026-06-01" })],
      people: [personWithRecords],
    });

    const employee = payload.employees[0];
    expect(employee.days).toHaveLength(30);
    expect(employee.days[0].checkIn).toBe("08:00");
    expect(employee.days[1].checkIn).toBe(EMPTY_CELL);
  });

  it("uses payroll summary as single source for employee month stats", () => {
    const payload = buildAttendanceReport({
      companyName: "شركة",
      branch,
      month: "2026-06-01",
      records: [makeRecord({ date: "2026-06-01" })],
      people: [personWithRecords],
    });

    const summaryRow = payload.summary.rows.find(
      (r) => r.externalEmployeeNumber === "100",
    );
    const employee = payload.employees.find(
      (e) => e.externalEmployeeNumber === "100",
    );

    expect(summaryRow?.fullTimeDays).toBe(1);
    expect(summaryRow?.earlyLeaveDays).toBe(1);
    expect(employee?.payroll.fullTimeDays).toBe(1);
    expect(employee?.payroll.earlyLeaveDays).toBe(1);
  });

  it("counts roster absences for employee with no punch records", () => {
    const payload = buildAttendanceReport({
      companyName: "شركة",
      branch,
      month: "2026-06-01",
      records: [],
      people: [personNoRecords],
    });

    const row = payload.summary.rows.find(
      (r) => r.externalEmployeeNumber === "200",
    );
    expect(row?.absentDays).toBe(30);
    expect(payload.employees[0].payroll.absentDays).toBe(30);
  });

  it("exposes canonical report labels", () => {
    expect(REPORT_LABELS.fullTimeDays).toBe("عدد ايام الدوام الكامل");
    expect(REPORT_LABELS.earlyLeaveDays).toBe("عدد ايام الخروج المبكر");
  });

  it("keeps PDF and Excel footer stats in parity for employee #100", async () => {
    const payload = buildAttendanceReport({
      companyName: "شركة",
      branch,
      month: "2026-06-01",
      records: [makeRecord({ date: "2026-06-01" })],
      people: [personWithRecords],
    });

    const employee = payload.employees.find(
      (e) => e.externalEmployeeNumber === "100",
    );
    expect(employee).toBeDefined();

    const html = buildAttendanceReportHtml(payload);
    for (const line of buildEmployeeMonthFooterLines(employee!.payroll)) {
      expect(html).toContain(line);
    }

    const buffer = await buildMonthlyAttendanceWorkbook(payload);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const employeeSheet = workbook.worksheets.find((sheet) =>
      sheet.name.includes("100"),
    );
    expect(employeeSheet).toBeDefined();

    const summaryRow = 6 + 30 + 1;
    buildEmployeeMonthFooterLines(employee!.payroll).forEach((line, index) => {
      expect(employeeSheet?.getCell(`B${summaryRow + index}`).value).toBe(
        line,
      );
    });
  });
});
