import { describe, expect, it } from "vitest";
import {
  buildAttendanceReport,
  DAILY_COLUMN_HEADERS,
  REPORT_LABELS,
} from "@/lib/attendance/attendance-report";
import { buildAttendanceReportHtml } from "@/lib/attendance/attendance-pdf";
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

describe("buildAttendanceReportHtml", () => {
  it("uses canonical labels in summary and daily tables", () => {
    const html = buildAttendanceReportHtml(buildFixtureReport());

    expect(html).toContain(`<th>${REPORT_LABELS.fullTimeDays}</th>`);
    expect(html).toContain(`<th>${REPORT_LABELS.earlyLeaveDays}</th>`);
    expect(html).not.toContain("<th>حضور</th>");
    expect(html).not.toContain("<th>دوام كامل</th>");
    for (const header of DAILY_COLUMN_HEADERS) {
      expect(html).toContain(`<th>${header}</th>`);
    }
  });

  it("renders employee header and footer from payroll row", () => {
    const html = buildAttendanceReportHtml(buildFixtureReport());

    expect(html).toContain(
      `${REPORT_LABELS.fullTimeDays}: <strong>1</strong>`,
    );
    expect(html).toContain(
      `${REPORT_LABELS.earlyLeaveDays}: <strong>1</strong>`,
    );
    expect(html).toContain(`${REPORT_LABELS.absentDays}: 29`);
    expect(html).toContain(`${REPORT_LABELS.totalDeductionHours}: 0:00`);
  });
});
