import { describe, expect, it } from "vitest";
import {
  computeSessionRecord,
  DEFAULT_FULL_TIME_CONFIG,
} from "@/lib/attendance/shift-matching";
import type { PunchSession } from "@/lib/attendance/punch-sessions";
import type { AttendanceShift } from "@/types/db";

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
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
};

function makeSession(
  firstCheckIn: string,
  lastCheckOut: string,
  date = "2026-06-05",
): PunchSession {
  return {
    shiftDate: date,
    firstCheckIn,
    lastCheckOut,
    firstPunchDate: date,
    lastPunchDate: date,
    punchCount: 2,
    allPunchTimes: [
      { date, time: firstCheckIn },
      { date, time: lastCheckOut },
    ],
  };
}

describe("computeSessionRecord full-time late", () => {
  it("counts zero late when full-time employee punches on time", () => {
    const { computed } = computeSessionRecord(
      makeSession("09:30", "19:30"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.lateMinutes).toBe(0);
  });

  it("counts late minutes for full-time day using nearest shift start", () => {
    const { computed, shift } = computeSessionRecord(
      makeSession("10:00", "19:30"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(shift?.name).toBe("صباحي");
    expect(computed.lateMinutes).toBe(15);
  });

  it("uses 09:00 fallback when no shifts are configured", () => {
    const { computed } = computeSessionRecord(
      makeSession("10:30", "20:00"),
      [],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.lateMinutes).toBe(75);
  });

  it("includes late minutes in full-time deduction total", () => {
    const { computed } = computeSessionRecord(
      makeSession("10:00", "19:30"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    const shortfall = Math.max(
      0,
      DEFAULT_FULL_TIME_CONFIG.expectedMinutes - (computed.totalMinutes ?? 0),
    );
    expect(computed.deductionMinutes).toBe(computed.lateMinutes + shortfall);
  });
});
