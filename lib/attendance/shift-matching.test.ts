import { describe, expect, it } from "vitest";
import {
  computeOnePunchRecord,
  computeSessionRecord,
  DEFAULT_FULL_TIME_CONFIG,
  resolveShiftForSession,
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
  work_days: null,
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

  it("uses shortfall alone for full-time deduction (not late + shortfall)", () => {
    const { computed } = computeSessionRecord(
      makeSession("10:00", "19:30"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
    );

    const shortfall = Math.max(
      0,
      DEFAULT_FULL_TIME_CONFIG.expectedMinutes - (computed.totalMinutes ?? 0),
    );
    expect(computed.lateMinutes).toBeGreaterThan(0);
    expect(computed.deductionMinutes).toBe(shortfall);
  });
});

describe("computeSessionRecord full-time early leave", () => {
  // Branch-style config: threshold 9h, expected 11h (matches بن عاشور).
  const BRANCH_FULL_TIME = {
    thresholdMinutes: 9 * 60,
    expectedMinutes: 11 * 60,
  };

  const NIGHT_SHIFT: AttendanceShift = {
    ...MORNING_SHIFT,
    id: "shift-night",
    name: "ليلية",
    start_time: "16:00",
    end_time: "22:00",
    expected_minutes: 360,
  };

  const TWO_SHIFTS = [MORNING_SHIFT, NIGHT_SHIFT];

  it("matches check-in to morning and check-out to night independently", () => {
    // 11:00 vs morning 09:30 → late 75; 21:00 vs night 22:00 → early 45
    const { computed, shift } = computeSessionRecord(
      makeSession("11:00", "21:00"),
      TWO_SHIFTS,
      BRANCH_FULL_TIME,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(shift?.name).toBe("صباحي");
    expect(computed.lateMinutes).toBe(75);
    expect(computed.earlyLeaveMinutes).toBe(45);
  });

  it("counts early leave against nearest unpassed shift end (night)", () => {
    // Morning end 16:00 already passed at 19:58 → night 22:00 − 19:58 − 15 = 107
    const { computed } = computeSessionRecord(
      makeSession("09:30", "19:58"),
      TWO_SHIFTS,
      BRANCH_FULL_TIME,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.earlyLeaveMinutes).toBe(107);
    expect(computed.totalMinutes).toBe(628);
  });

  it("counts zero early leave near night's own end", () => {
    // 22:00 − 21:50 = 10 within 15 grace → 0
    const { computed } = computeSessionRecord(
      makeSession("09:30", "21:50"),
      TWO_SHIFTS,
      BRANCH_FULL_TIME,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.earlyLeaveMinutes).toBe(0);
  });

  it("counts zero early leave when checkout is at/after every shift end", () => {
    const { computed } = computeSessionRecord(
      makeSession("09:30", "22:00"),
      TWO_SHIFTS,
      BRANCH_FULL_TIME,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.earlyLeaveMinutes).toBe(0);
    expect(computed.overtimeMinutes).toBeGreaterThan(0);
  });

  it("uses 09:00 fallback start when no shifts are configured", () => {
    // Fallback start 09:00 + 660 = 20:00; checkout 19:00 → 60−15 = 45
    const { computed } = computeSessionRecord(
      makeSession("09:00", "19:00"),
      [],
      BRANCH_FULL_TIME,
    );

    expect(computed.shiftType).toBe("دوام كامل");
    expect(computed.earlyLeaveMinutes).toBe(45);
  });
});

describe("computeSessionRecord one-punch late", () => {
  function onePunchSession(time: string, date = "2026-06-05"): PunchSession {
    return {
      shiftDate: date,
      firstCheckIn: time,
      lastCheckOut: null,
      firstPunchDate: date,
      lastPunchDate: date,
      punchCount: 1,
      allPunchTimes: [{ date, time }],
    };
  }

  it("counts late minutes for one-punch after grace without deduction", () => {
    const { computed, shift } = computeSessionRecord(
      onePunchSession("10:00"),
      [MORNING_SHIFT],
    );

    expect(shift?.name).toBe("صباحي");
    expect(computed.lateMinutes).toBe(15);
    expect(computed.deductionMinutes).toBe(0);
    expect(computed.earlyLeaveMinutes).toBe(0);
    expect(computed.totalMinutes).toBeNull();
  });

  it("counts zero late when one-punch is within grace", () => {
    const { computed } = computeSessionRecord(
      onePunchSession("09:40"),
      [MORNING_SHIFT],
    );

    expect(computed.lateMinutes).toBe(0);
    expect(computed.deductionMinutes).toBe(0);
  });

  it("treats identical in/out as one-punch late day", () => {
    const { computed } = computeOnePunchRecord(
      makeSession("10:30", "10:30"),
      [MORNING_SHIFT],
    );

    expect(computed.lateMinutes).toBe(45);
    expect(computed.deductionMinutes).toBe(0);
    expect(computed.earlyLeaveMinutes).toBe(0);
  });

  it("treats a lone punch near shift end as early leave, not late", () => {
    // بن عاشور ليلية 16:00–22:00; punch 20:02 is nearer end than start.
    const nightShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-night",
      name: "ليلية",
      start_time: "16:00",
      end_time: "22:00",
      expected_minutes: 360,
    };

    const { computed, shift } = computeSessionRecord(
      onePunchSession("20:02"),
      [nightShift],
    );

    // expected end 22:00 − 20:02 = 118 − 15 grace = 103
    expect(shift?.name).toBe("ليلية");
    expect(computed.lateMinutes).toBe(0);
    expect(computed.earlyLeaveMinutes).toBe(103);
    expect(computed.deductionMinutes).toBe(0);
  });

  it("picks night shift by end proximity when morning start is farther", () => {
    const nightShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-night",
      name: "ليلية",
      start_time: "16:00",
      end_time: "22:00",
      expected_minutes: 360,
    };

    const { computed, shift } = computeSessionRecord(
      onePunchSession("20:02"),
      [MORNING_SHIFT, nightShift],
    );

    expect(shift?.name).toBe("ليلية");
    expect(computed.lateMinutes).toBe(0);
    expect(computed.earlyLeaveMinutes).toBe(103);
  });

  it("treats after-end morning punch as night late check-in, not zero checkout", () => {
    // بن عاشور: morning 10:30–16:00, night 16:00–22:00; punch 18:41 is after morning end.
    const morningBanAshour: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-morning-ba",
      start_time: "10:30",
      end_time: "16:00",
      expected_minutes: 330,
    };
    const nightShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-night",
      name: "ليلية",
      start_time: "16:00",
      end_time: "22:00",
      expected_minutes: 360,
    };

    const { computed, shift } = computeSessionRecord(
      onePunchSession("18:41"),
      [morningBanAshour, nightShift],
    );

    // 18:41 − 16:00 − 15 grace = 146
    expect(shift?.name).toBe("ليلية");
    expect(computed.lateMinutes).toBe(146);
    expect(computed.earlyLeaveMinutes).toBe(0);
    expect(computed.deductionMinutes).toBe(0);
  });

  it("ignores preferred morning when punch is after its end and rematches night", () => {
    const morningBanAshour: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-morning-ba",
      start_time: "10:30",
      end_time: "16:00",
      expected_minutes: 330,
    };
    const nightShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "shift-night",
      name: "ليلية",
      start_time: "16:00",
      end_time: "22:00",
      expected_minutes: 360,
    };

    const { computed, shift } = computeOnePunchRecord(
      onePunchSession("18:41"),
      [morningBanAshour, nightShift],
      morningBanAshour,
    );

    expect(shift?.name).toBe("ليلية");
    expect(computed.lateMinutes).toBe(146);
    expect(computed.earlyLeaveMinutes).toBe(0);
  });

  it("treats a lone punch near morning start as late, not early leave", () => {
    const { computed, shift } = computeSessionRecord(
      onePunchSession("10:00"),
      [MORNING_SHIFT],
    );

    expect(shift?.name).toBe("صباحي");
    expect(computed.lateMinutes).toBe(15);
    expect(computed.earlyLeaveMinutes).toBe(0);
  });
});

describe("resolveShiftForSession work_days", () => {
  // 2026-06-05 is Friday (5)
  it("skips shifts that do not run on the session weekday", () => {
    const weekdayShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "weekday-only",
      work_days: [0, 1, 2, 3, 4, 6],
    };
    const fridayShift: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "friday-only",
      name: "جمعة",
      start_time: "10:00",
      work_days: [5],
    };

    const session = makeSession("10:05", "16:00", "2026-06-05");
    expect(resolveShiftForSession(session, [weekdayShift])).toBeNull();
    expect(resolveShiftForSession(session, [weekdayShift, fridayShift])?.id).toBe(
      "friday-only",
    );
  });
});
