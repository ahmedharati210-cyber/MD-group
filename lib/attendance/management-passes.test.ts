import { describe, expect, it } from "vitest";
import {
  applyManagementPasses,
  mergeManagementPassesIntoPayload,
  parseManagementPassesFromForm,
  readManagementPasses,
} from "@/lib/attendance/management-passes";
import {
  SHIFT_FULL,
  type ComputedDay,
} from "@/lib/attendance/monthly-calculations";
import { buildRecalculatedRecordPatch } from "@/lib/attendance/recalculate-person-month";
import type { AttendancePerson, AttendanceShift } from "@/types/db";

function makeComputed(overrides: Partial<ComputedDay> = {}): ComputedDay {
  return {
    shiftType: "صباحي",
    expectedMinutes: 390,
    totalMinutes: 360,
    lateMinutes: 30,
    earlyLeaveMinutes: 20,
    overtimeMinutes: 0,
    deductionMinutes: 50,
    isAbsent: false,
    notes: null,
    ...overrides,
  };
}

describe("applyManagementPasses", () => {
  it("zeros late and subtracts from deduction", () => {
    const result = applyManagementPasses(makeComputed(), {
      waiveLate: true,
      waiveEarlyLeave: false,
    });
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(20);
    expect(result.deductionMinutes).toBe(20);
  });

  it("zeros early leave and subtracts from deduction", () => {
    const result = applyManagementPasses(makeComputed(), {
      waiveLate: false,
      waiveEarlyLeave: true,
    });
    expect(result.lateMinutes).toBe(30);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.deductionMinutes).toBe(30);
  });

  it("zeros late/early on full-time but leaves shortfall deduction unchanged", () => {
    const result = applyManagementPasses(
      makeComputed({
        shiftType: SHIFT_FULL,
        lateMinutes: 15,
        earlyLeaveMinutes: 10,
        deductionMinutes: 30, // shortfall only
      }),
      { waiveLate: true, waiveEarlyLeave: true },
    );
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.deductionMinutes).toBe(30);
  });

  it("still subtracts waived late/early from regular-shift deduction", () => {
    const result = applyManagementPasses(
      makeComputed({
        shiftType: "صباحي",
        lateMinutes: 15,
        earlyLeaveMinutes: 20,
        deductionMinutes: 35,
      }),
      { waiveLate: true, waiveEarlyLeave: false },
    );
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(20);
    expect(result.deductionMinutes).toBe(20);
  });
});

describe("management pass payload helpers", () => {
  it("reads and merges flags", () => {
    expect(readManagementPasses({ waive_late: true })).toEqual({
      waiveLate: true,
      waiveEarlyLeave: false,
    });
    expect(
      mergeManagementPassesIntoPayload(
        { other: 1 },
        { waiveLate: true, waiveEarlyLeave: false },
      ),
    ).toEqual({ other: 1, waive_late: true });
    expect(
      mergeManagementPassesIntoPayload(
        { waive_late: true, waive_early_leave: true },
        { waiveLate: false, waiveEarlyLeave: false },
      ),
    ).toEqual({});
  });

  it("parses form checkboxes", () => {
    const fd = new FormData();
    fd.set("waive_late", "true");
    expect(parseManagementPassesFromForm(fd)).toEqual({
      waiveLate: true,
      waiveEarlyLeave: false,
    });
  });
});

describe("recalc preserves management passes", () => {
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
    work_days: null,
    active: true,
    display_order: 0,
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
  };

  it("keeps waived late at 0 after rematch", () => {
    const patch = buildRecalculatedRecordPatch(
      {
        id: "r1",
        date: "2026-06-05",
        first_check_in: "10:30:00",
        last_check_out: "16:00:00",
        punch_count: 2,
        leave_type: null,
        raw_payload: { waive_late: true },
      },
      person,
      [MORNING_SHIFT],
      null,
    );

    expect(patch).not.toBeNull();
    expect(patch!.late_minutes).toBe(0);
    expect(patch!.raw_payload.waive_late).toBe(true);
    // Without waive this check-in would be late vs 09:30 + 15 grace
    expect(patch!.deduction_minutes).toBe(patch!.early_leave_minutes);
  });
});
