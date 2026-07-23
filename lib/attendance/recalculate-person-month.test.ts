import { describe, expect, it } from "vitest";
import {
  buildRecalculatedRecordPatch,
  shouldSkipPersonMonthRecalculate,
} from "@/lib/attendance/recalculate-person-month";
import { DEFAULT_FULL_TIME_CONFIG } from "@/lib/attendance/shift-matching";
import type { AttendancePerson, AttendanceShift } from "@/types/db";

const MORNING_SHIFT: AttendanceShift = {
  id: "shift-morning",
  company_id: "c1",
  branch_id: "b1",
  name: "صباحي",
  start_time: "09:30",
  end_time: "16:00",
  crosses_midnight: false,
  checkout_cutoff_time: null,
  expected_minutes: 390,
  late_grace_minutes: 15,
  early_leave_grace_minutes: 15,
  check_in_window_start: null,
  check_in_window_end: null,
  check_out_window_start: null,
  check_out_window_end: null,
  active: true,
  work_days: null,
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
};

function makePerson(
  overrides: Partial<AttendancePerson> = {},
): AttendancePerson {
  return {
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
    custom_start_time: null,
    custom_end_time: null,
    custom_crosses_midnight: false,
    custom_late_grace_minutes: 15,
    custom_early_leave_grace_minutes: 15,
    custom_work_days: null,
    annual_leave_remaining: 14,
    sick_leave_remaining: 4,
    leave_balance_reset_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("shouldSkipPersonMonthRecalculate", () => {
  it("skips leave rows", () => {
    expect(
      shouldSkipPersonMonthRecalculate({
        id: "r1",
        date: "2026-06-05",
        first_check_in: "10:00",
        last_check_out: "16:00",
        punch_count: 2,
        leave_type: "إجازة سنوية",
        raw_payload: null,
      }),
    ).toBe(true);
  });

  it("skips rows with no punches", () => {
    expect(
      shouldSkipPersonMonthRecalculate({
        id: "r1",
        date: "2026-06-05",
        first_check_in: null,
        last_check_out: null,
        punch_count: null,
        leave_type: null,
        raw_payload: { manual_absent: true },
      }),
    ).toBe(true);
  });
});

describe("buildRecalculatedRecordPatch", () => {
  it("rematches stored punches against custom schedule, not branch shift", () => {
    const person = makePerson({
      custom_start_time: "10:00:00",
      custom_end_time: "18:00:00",
      custom_late_grace_minutes: 15,
    });

    // 10:10 is within custom grace (start 10:00); vs branch 09:30 it would be late.
    const patch = buildRecalculatedRecordPatch(
      {
        id: "r1",
        date: "2026-06-05",
        first_check_in: "10:10:00",
        last_check_out: "18:00:00",
        punch_count: 2,
        leave_type: null,
        raw_payload: {
          all_punch_times: [
            { date: "2026-06-05", time: "10:10" },
            { date: "2026-06-05", time: "18:00" },
          ],
        },
      },
      person,
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    const branchOnly = buildRecalculatedRecordPatch(
      {
        id: "r1",
        date: "2026-06-05",
        first_check_in: "10:10:00",
        last_check_out: "18:00:00",
        punch_count: 2,
        leave_type: null,
        raw_payload: null,
      },
      makePerson(),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(patch).not.toBeNull();
    expect(patch!.shift_id).toBeNull();
    expect(patch!.late_minutes).toBe(0);
    expect(branchOnly!.late_minutes).toBeGreaterThan(0);
    expect(patch!.raw_payload.custom_schedule).toMatchObject({
      person_id: "p1",
      start_time: "10:00",
      end_time: "18:00",
    });
  });

  it("marks late against custom start when beyond grace", () => {
    const person = makePerson({
      custom_start_time: "10:00:00",
      custom_end_time: "18:00:00",
      custom_late_grace_minutes: 15,
    });

    const patch = buildRecalculatedRecordPatch(
      {
        id: "r1",
        date: "2026-06-05",
        first_check_in: "10:30:00",
        last_check_out: "18:00:00",
        punch_count: 2,
        leave_type: null,
        raw_payload: null,
      },
      person,
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(patch).not.toBeNull();
    expect(patch!.late_minutes).toBeGreaterThan(0);
    expect(patch!.shift_id).toBeNull();
  });

  it("returns null for leave rows", () => {
    const person = makePerson({
      custom_start_time: "10:00",
      custom_end_time: "18:00",
    });
    expect(
      buildRecalculatedRecordPatch(
        {
          id: "r1",
          date: "2026-06-05",
          first_check_in: null,
          last_check_out: null,
          punch_count: null,
          leave_type: "إجازة مرضية",
          raw_payload: null,
        },
        person,
        [MORNING_SHIFT],
        DEFAULT_FULL_TIME_CONFIG,
      ),
    ).toBeNull();
  });
});
