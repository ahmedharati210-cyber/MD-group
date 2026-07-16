import { describe, expect, it } from "vitest";
import {
  buildBranchPayrollSummary,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import type { AttendanceMonthlyRecord, AttendancePerson } from "@/types/db";

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
    shift_type: null,
    expected_minutes: 480,
    late_minutes: 0,
    early_leave_minutes: 0,
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

describe("buildPersonMonthStats", () => {
  it("counts fullTimeDays when shift_type is دوام كامل", () => {
    const stats = buildPersonMonthStats("2026-06", [
      makeRecord({ date: "2026-06-01", shift_type: "دوام كامل" }),
      makeRecord({ date: "2026-06-02", shift_type: "دوام جزئي" }),
      makeRecord({ date: "2026-06-03", shift_type: "دوام كامل" }),
    ]);

    expect(stats.fullTimeDays).toBe(2);
    expect(stats.earlyLeaveDays).toBe(0);
  });

  it("counts earlyLeaveDays when early_leave_minutes is positive", () => {
    const stats = buildPersonMonthStats("2026-06", [
      makeRecord({ date: "2026-06-01", early_leave_minutes: 30 }),
      makeRecord({ date: "2026-06-02", early_leave_minutes: 0 }),
      makeRecord({ date: "2026-06-03", early_leave_minutes: 15 }),
    ]);

    expect(stats.earlyLeaveDays).toBe(2);
    expect(stats.fullTimeDays).toBe(0);
  });

  it("skips holiday and leave days for fullTimeDays and earlyLeaveDays", () => {
    const stats = buildPersonMonthStats("2026-06", [
      makeRecord({
        date: "2026-06-01",
        leave_type: "عطلة",
        shift_type: "دوام كامل",
        early_leave_minutes: 20,
      }),
      makeRecord({
        date: "2026-06-02",
        leave_type: "إجازة سنوية",
        shift_type: "دوام كامل",
        early_leave_minutes: 20,
      }),
      makeRecord({ date: "2026-06-03", is_absent: true }),
    ]);

    expect(stats.fullTimeDays).toBe(0);
    expect(stats.earlyLeaveDays).toBe(0);
    expect(stats.weekendDays).toBe(1);
    expect(stats.leaveDays).toBe(1);
    expect(stats.absentDays).toBeGreaterThanOrEqual(1);
  });

  it("counts one-punch late as a late day without deducted minutes", () => {
    const stats = buildPersonMonthStats("2026-06", [
      makeRecord({
        date: "2026-06-01",
        last_check_out: null,
        punch_count: 1,
        late_minutes: 25,
        deduction_minutes: 25,
      }),
      makeRecord({
        date: "2026-06-02",
        late_minutes: 10,
        deduction_minutes: 10,
      }),
    ]);

    expect(stats.onePunchDays).toBe(1);
    expect(stats.lateDays).toBe(2);
    expect(stats.totalDeductionMinutes).toBe(10);
  });
});

describe("buildBranchPayrollSummary one-punch late", () => {
  const person: AttendancePerson = {
    id: "p1",
    company_id: "c1",
    branch_id: "b1",
    external_employee_number: "100",
    full_name: "موظف",
    active: true,
    first_seen_at: "2026-01-01T00:00:00Z",
    last_seen_at: "2026-01-01T00:00:00Z",
    notes: null,
    raw_department_hint: null,
    shift_id: null,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("counts late day but excludes one-punch late minutes from totals", () => {
    const { rows, totals } = buildBranchPayrollSummary(
      "2026-06",
      [
        makeRecord({
          date: "2026-06-01",
          last_check_out: null,
          punch_count: 1,
          late_minutes: 40,
          deduction_minutes: 40,
          total_minutes: null,
        }),
      ],
      [person],
    );

    expect(rows[0]?.onePunchDays).toBe(1);
    expect(rows[0]?.lateDays).toBe(1);
    expect(rows[0]?.totalLateMinutes).toBe(0);
    expect(rows[0]?.totalDeductionMinutes).toBe(0);
    expect(totals.lateDays).toBe(1);
    expect(totals.totalLateMinutes).toBe(0);
  });
});
