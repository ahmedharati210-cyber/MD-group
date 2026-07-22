import { describe, expect, it } from "vitest";
import {
  classifyPersonDayStatus,
  personDayStatusLabel,
} from "@/lib/attendance/status-labels";
import type { AttendanceMonthlyRecord } from "@/types/db";

function record(
  partial: Partial<AttendanceMonthlyRecord>,
): AttendanceMonthlyRecord {
  return {
    id: "r1",
    import_id: "i1",
    company_id: "c1",
    branch_id: "b1",
    attendance_person_id: "p1",
    profile_id: null,
    external_employee_number: "1",
    employee_name: "Test",
    date: "2026-06-01",
    first_check_in: null,
    last_check_out: null,
    total_minutes: null,
    shift_type: null,
    expected_minutes: null,
    late_minutes: 0,
    early_leave_minutes: 0,
    overtime_minutes: 0,
    deduction_minutes: 0,
    is_holiday: false,
    is_absent: false,
    leave_type: null,
    notes: null,
    punch_count: null,
    shift_id: null,
    raw_payload: null,
    created_at: "",
    ...partial,
  } as AttendanceMonthlyRecord;
}

describe("status-labels", () => {
  it("uses غياب for missing or absent records", () => {
    expect(personDayStatusLabel(classifyPersonDayStatus(null))).toBe("غياب");
    expect(
      personDayStatusLabel(
        classifyPersonDayStatus(record({ is_absent: true })),
      ),
    ).toBe("غياب");
  });

  it("detects one-punch days", () => {
    expect(
      classifyPersonDayStatus(
        record({ first_check_in: "09:00", last_check_out: null, punch_count: 1 }),
      ),
    ).toBe("onePunch");
  });

  it("marks non-work days as off when work context is provided", () => {
    // 2026-06-05 is a Friday (weekday 5)
    expect(
      classifyPersonDayStatus(null, {
        date: "2026-06-05",
        workDays: [0, 1, 2, 3, 4],
      }),
    ).toBe("off");
    expect(
      classifyPersonDayStatus(record({ is_absent: true }), {
        date: "2026-06-05",
        workDays: [0, 1, 2, 3, 4],
      }),
    ).toBe("off");
    expect(
      classifyPersonDayStatus(
        record({
          is_absent: true,
          raw_payload: { manual_absent: true },
        }),
        { date: "2026-06-05", workDays: [0, 1, 2, 3, 4] },
      ),
    ).toBe("absent");
  });
});
