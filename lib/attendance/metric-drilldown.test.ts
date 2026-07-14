import { describe, expect, it } from "vitest";
import { buildPersonMonthStats } from "@/lib/attendance/attendance-view";
import {
  filterPersonMetricDays,
  type PersonMetricKey,
} from "@/lib/attendance/metric-drilldown";
import type { AttendanceMonthlyRecord } from "@/types/db";

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
    shift_type: "صباحي",
    expected_minutes: 330,
    late_minutes: 10,
    early_leave_minutes: 15,
    overtime_minutes: 0,
    deduction_minutes: 30,
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

const month = "2026-06";
const records = [
  makeRecord("2026-06-01"),
  makeRecord("2026-06-02", {
    shift_type: "دوام كامل",
    early_leave_minutes: 0,
    late_minutes: 0,
    deduction_minutes: 0,
  }),
  makeRecord("2026-06-03", {
    last_check_out: null,
    punch_count: 1,
    late_minutes: 0,
    early_leave_minutes: 0,
    deduction_minutes: 0,
  }),
  makeRecord("2026-06-04", {
    is_absent: true,
    first_check_in: null,
    last_check_out: null,
    late_minutes: 0,
    early_leave_minutes: 0,
    deduction_minutes: 0,
  }),
  makeRecord("2026-06-05", { leave_type: "إجازة سنوية" }),
];

describe("filterPersonMetricDays", () => {
  const stats = buildPersonMonthStats(month, records);

  const metricExpectations: Array<[PersonMetricKey, number]> = [
    ["fullTimeDays", stats.fullTimeDays],
    ["absentDays", stats.absentDays],
    ["onePunchDays", stats.onePunchDays],
    ["lateDays", stats.lateDays],
    ["earlyLeaveDays", stats.earlyLeaveDays],
  ];

  it.each(metricExpectations.slice(0, 5))(
    "returns %s row count matching person month stats",
    (metric, expectedCount) => {
      const rows = filterPersonMetricDays(month, records, metric);
      expect(rows).toHaveLength(expectedCount);
    },
  );

  it("returns deduction day rows excluding leave days", () => {
    const rows = filterPersonMetricDays(month, records, "totalDeductionMinutes");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.date).toBe("2026-06-01");
  });

  it("includes absent days without punch times", () => {
    const rows = filterPersonMetricDays(month, records, "absentDays");
    const noRecordDay = rows.find((row) => row.date === "2026-06-10");
    expect(noRecordDay).toBeDefined();
    expect(noRecordDay?.checkIn).toBe("—");
    expect(noRecordDay?.checkOut).toBe("—");
  });

  it("includes early leave detail for matching day", () => {
    const rows = filterPersonMetricDays(month, records, "earlyLeaveDays");
    expect(rows[0]?.detailValue).toBe("15 د");
    expect(rows[0]?.checkIn).toBe("08:00");
  });
});
