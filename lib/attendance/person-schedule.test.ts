import { describe, expect, it } from "vitest";
import {
  computeSessionRecord,
  DEFAULT_FULL_TIME_CONFIG,
} from "@/lib/attendance/shift-matching";
import {
  isPersonWorkDay,
  normalizeWorkDaysSelection,
  personHasCustomSchedule,
  personToSyntheticShift,
  resolvePersonWorkDays,
} from "@/lib/attendance/person-schedule";
import {
  buildPersonCalendarDays,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import type { AttendanceMonthlyRecord, AttendancePerson, AttendanceShift } from "@/types/db";
import type { PunchSession } from "@/lib/attendance/punch-sessions";

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

describe("person custom schedule helpers", () => {
  it("detects custom schedule only when both times are set", () => {
    expect(personHasCustomSchedule(makePerson())).toBe(false);
    expect(
      personHasCustomSchedule(
        makePerson({ custom_start_time: "10:00", custom_end_time: null }),
      ),
    ).toBe(false);
    expect(
      personHasCustomSchedule(
        makePerson({ custom_start_time: "10:00", custom_end_time: "18:00" }),
      ),
    ).toBe(true);
  });

  it("builds synthetic shift from person times", () => {
    const shift = personToSyntheticShift(
      makePerson({
        custom_start_time: "10:00",
        custom_end_time: "18:00",
        custom_late_grace_minutes: 10,
      }),
    );
    expect(shift?.name).toBe("جدول مخصص");
    expect(shift?.start_time).toBe("10:00");
    expect(shift?.expected_minutes).toBe(480);
    expect(shift?.late_grace_minutes).toBe(10);
  });
});

describe("preferred custom shift matching", () => {
  it("uses custom start for late minutes instead of nearest branch shift", () => {
    const preferred = personToSyntheticShift(
      makePerson({
        custom_start_time: "10:00",
        custom_end_time: "18:00",
        custom_late_grace_minutes: 15,
      }),
    );
    const { computed, shift } = computeSessionRecord(
      makeSession("10:30", "18:00"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
      preferred,
    );

    expect(shift?.name).toBe("جدول مخصص");
    // 10:30 vs 10:00 + 15 grace → 15 late
    expect(computed.lateMinutes).toBe(15);
    expect(computed.shiftType).toBe("جدول مخصص");
  });

  it("falls back to nearest branch shift when no preferred shift", () => {
    const { computed, shift } = computeSessionRecord(
      makeSession("10:00", "16:00"),
      [MORNING_SHIFT],
      DEFAULT_FULL_TIME_CONFIG,
      null,
    );
    expect(shift?.name).toBe("صباحي");
    expect(computed.lateMinutes).toBe(15);
  });
});

describe("non-work weekday absent skip", () => {
  // 2026-06-05 is Friday (5), 2026-06-01 is Monday (1)
  const workDays = [0, 1, 2, 3, 4, 6]; // not Friday

  it("isPersonWorkDay respects custom weekdays", () => {
    expect(isPersonWorkDay("2026-06-05", workDays)).toBe(false);
    expect(isPersonWorkDay("2026-06-01", workDays)).toBe(true);
    expect(isPersonWorkDay("2026-06-05", null)).toBe(true);
  });

  it("does not count absent on non-work weekday without a record", () => {
    const stats = buildPersonMonthStats(
      "2026-06",
      [makeRecord("2026-06-01")],
      workDays,
    );
    const fridayAbsentWithoutSchedule = buildPersonMonthStats(
      "2026-06",
      [makeRecord("2026-06-01")],
      null,
    );

    expect(stats.absentDays).toBeLessThan(fridayAbsentWithoutSchedule.absentDays);

    const days = buildPersonCalendarDays("2026-06", [], workDays);
    const friday = days.find((d) => d.date === "2026-06-05");
    expect(friday?.absent).toBe(0);

    const monday = days.find((d) => d.date === "2026-06-01");
    expect(monday?.absent).toBe(1);
  });
});

describe("resolvePersonWorkDays", () => {
  it("prefers custom schedule work days over assigned shift", () => {
    const person = makePerson({
      custom_start_time: "10:00",
      custom_end_time: "18:00",
      custom_work_days: [1, 2, 3],
      shift_id: "shift-morning",
    });
    const shift: AttendanceShift = {
      ...MORNING_SHIFT,
      work_days: [0, 6],
    };
    expect(resolvePersonWorkDays(person, [shift])).toEqual([1, 2, 3]);
  });

  it("uses assigned shift work days when no custom schedule", () => {
    const person = makePerson({
      shift_id: "shift-morning",
      custom_work_days: [1, 2],
    });
    const shift: AttendanceShift = {
      ...MORNING_SHIFT,
      work_days: [0, 1, 2, 3, 4],
    };
    expect(resolvePersonWorkDays(person, [shift])).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses a single active branch shift when person has no assignment", () => {
    const shift: AttendanceShift = {
      ...MORNING_SHIFT,
      work_days: [0, 1, 2, 3, 4],
    };
    expect(resolvePersonWorkDays(makePerson(), [shift])).toEqual([0, 1, 2, 3, 4]);
  });

  it("intersects active branch shift work days when multiple exist", () => {
    const morning: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "a",
      work_days: [0, 1, 2, 3, 4, 6],
    };
    const evening: AttendanceShift = {
      ...MORNING_SHIFT,
      id: "b",
      name: "مسائية",
      work_days: [0, 1, 2, 3, 4],
    };
    expect(resolvePersonWorkDays(makePerson(), [morning, evening])).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("returns null (all days) when the only active shift has null work_days", () => {
    expect(resolvePersonWorkDays(makePerson(), [MORNING_SHIFT])).toBeNull();
  });

  it("normalizeWorkDaysSelection stores null when all seven days selected", () => {
    expect(normalizeWorkDaysSelection([0, 1, 2, 3, 4, 5, 6])).toBeNull();
    expect(normalizeWorkDaysSelection([1, 2, 3])).toEqual([1, 2, 3]);
  });
});
