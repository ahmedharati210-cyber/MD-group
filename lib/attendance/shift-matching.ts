import {
  computeDayRecord,
  parseTimeToMinutes,
  SHIFT_FULL,
  type ComputedDay,
} from "@/lib/attendance/monthly-calculations";
import type { PunchSession } from "@/lib/attendance/punch-sessions";
import { sessionTotalMinutes as calcSessionMinutes } from "@/lib/attendance/punch-sessions";
import type { AttendanceShift } from "@/types/db";

export type FullTimeConfig = {
  thresholdMinutes: number;
  expectedMinutes: number;
};

export const DEFAULT_FULL_TIME_CONFIG: FullTimeConfig = {
  thresholdMinutes: 9 * 60,
  expectedMinutes: 14 * 60,
};

function timeToMinutes(time: string): number {
  const parsed = parseTimeToMinutes(time);
  return parsed ?? 0;
}

function minutesOnClock(minutes: number): number {
  return ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 * 60 - diff);
}

function computeFullTimeRecord(
  session: PunchSession,
  config: FullTimeConfig,
): ComputedDay {
  const totalMinutes = calcSessionMinutes(session);
  const expectedMinutes = config.expectedMinutes;
  const overtimeMinutes = Math.max(0, totalMinutes - expectedMinutes);
  const deductionMinutes = Math.max(0, expectedMinutes - totalMinutes);

  return {
    shiftType: SHIFT_FULL,
    expectedMinutes,
    totalMinutes,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes,
    deductionMinutes,
    isAbsent: false,
    notes:
      session.punchCount > 12 ? `بصمات متعددة (${session.punchCount})` : null,
  };
}

/**
 * Resolve which shift applies to a punch session by nearest active start time.
 */
export function resolveShiftForSession(
  session: PunchSession,
  shifts: AttendanceShift[],
): AttendanceShift | null {
  const active = shifts.filter((s) => s.active);
  if (active.length === 0 || !session.firstCheckIn) return null;

  const checkInMinutes = timeToMinutes(session.firstCheckIn);
  let best: AttendanceShift | null = null;
  let bestDist = Infinity;

  for (const shift of active) {
    const startMinutes = timeToMinutes(shift.start_time.slice(0, 5));
    const dist = circularDistance(checkInMinutes, startMinutes);
    if (dist < bestDist) {
      bestDist = dist;
      best = shift;
    }
  }

  return best;
}

export function computeDayRecordWithShift(
  session: PunchSession,
  shift: AttendanceShift,
): ComputedDay {
  const firstCheckIn = session.firstCheckIn;
  const lastCheckOut = session.lastCheckOut;
  const totalMinutes = calcSessionMinutes(session);

  if (!firstCheckIn || !lastCheckOut) {
    return computeDayRecord({ firstCheckIn, lastCheckOut });
  }

  const startExpected = timeToMinutes(shift.start_time.slice(0, 5));
  const checkInMinutes = timeToMinutes(firstCheckIn);
  const checkOutMinutes = timeToMinutes(lastCheckOut);

  let lateMinutes = Math.max(
    0,
    checkInMinutes - startExpected - shift.late_grace_minutes,
  );

  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  if (shift.expected_minutes != null) {
    const expectedEnd = minutesOnClock(startExpected + shift.expected_minutes);
    if (shift.crosses_midnight && checkOutMinutes < startExpected) {
      const adjustedCheckout = checkOutMinutes + 24 * 60;
      const adjustedExpectedEnd = startExpected + shift.expected_minutes;
      earlyLeaveMinutes = Math.max(
        0,
        adjustedExpectedEnd - adjustedCheckout - shift.early_leave_grace_minutes,
      );
    } else {
      earlyLeaveMinutes = Math.max(
        0,
        expectedEnd - checkOutMinutes - shift.early_leave_grace_minutes,
      );
    }

    const delta = totalMinutes - shift.expected_minutes;
    if (delta > 0) overtimeMinutes = delta;
  }

  const deductionMinutes = lateMinutes + earlyLeaveMinutes;

  return {
    shiftType: shift.name,
    expectedMinutes: shift.expected_minutes,
    totalMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    deductionMinutes,
    isAbsent: false,
    notes: session.punchCount > 12 ? `بصمات متعددة (${session.punchCount})` : null,
  };
}

export function computeSessionRecord(
  session: PunchSession,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig = DEFAULT_FULL_TIME_CONFIG,
): { computed: ComputedDay; shift: AttendanceShift | null } {
  const firstCheckIn = session.firstCheckIn;
  const lastCheckOut = session.lastCheckOut;

  if (!firstCheckIn && !lastCheckOut) {
    return {
      computed: computeDayRecord({ firstCheckIn, lastCheckOut }),
      shift: null,
    };
  }

  if (!firstCheckIn || !lastCheckOut) {
    return {
      computed: computeDayRecord({ firstCheckIn, lastCheckOut }),
      shift: null,
    };
  }

  const totalMinutes = calcSessionMinutes(session);
  if (totalMinutes >= fullTimeConfig.thresholdMinutes) {
    return {
      computed: computeFullTimeRecord(session, fullTimeConfig),
      shift: null,
    };
  }

  const shift = resolveShiftForSession(session, shifts);
  if (shift) {
    return { computed: computeDayRecordWithShift(session, shift), shift };
  }

  return {
    computed: computeDayRecord(
      { firstCheckIn, lastCheckOut },
      fullTimeConfig,
    ),
    shift: null,
  };
}
