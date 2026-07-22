import {
  computeDayRecord,
  incompletePunchDay,
  parseTimeToMinutes,
  SHIFT_FULL,
  type ComputedDay,
} from "@/lib/attendance/monthly-calculations";
import { isPersonWorkDay } from "@/lib/attendance/person-schedule";
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

const FALLBACK_START_MINUTES = 9 * 60;
const FALLBACK_LATE_GRACE_MINUTES = 15;

function computeLateMinutesForFullTime(
  firstCheckIn: string | null,
  shift: AttendanceShift | null,
): number {
  if (!firstCheckIn) return 0;
  const checkInMinutes = timeToMinutes(firstCheckIn);
  const startExpected = shift
    ? timeToMinutes(shift.start_time.slice(0, 5))
    : FALLBACK_START_MINUTES;
  const grace = shift?.late_grace_minutes ?? FALLBACK_LATE_GRACE_MINUTES;
  return Math.max(0, checkInMinutes - startExpected - grace);
}

function computeFullTimeRecord(
  session: PunchSession,
  config: FullTimeConfig,
  shift: AttendanceShift | null = null,
): ComputedDay {
  const totalMinutes = calcSessionMinutes(session);
  const expectedMinutes = config.expectedMinutes;
  const lateMinutes = computeLateMinutesForFullTime(session.firstCheckIn, shift);
  const overtimeMinutes = Math.max(0, totalMinutes - expectedMinutes);
  const shortfallMinutes = Math.max(0, expectedMinutes - totalMinutes);
  const deductionMinutes = lateMinutes + shortfallMinutes;

  return {
    shiftType: SHIFT_FULL,
    expectedMinutes,
    totalMinutes,
    lateMinutes,
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
 * Only shifts scheduled for the session weekday are considered.
 */
export function resolveShiftForSession(
  session: PunchSession,
  shifts: AttendanceShift[],
): AttendanceShift | null {
  const active = shifts.filter(
    (s) => s.active && isPersonWorkDay(session.shiftDate, s.work_days),
  );
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

/**
 * One-punch day: count lateness for lateDays, but never deduct time or early leave.
 */
export function computeOnePunchRecord(
  session: PunchSession,
  shifts: AttendanceShift[],
  preferredShift: AttendanceShift | null = null,
): { computed: ComputedDay; shift: AttendanceShift | null } {
  const punchTime = session.firstCheckIn ?? session.lastCheckOut;
  if (!punchTime) {
    return { computed: incompletePunchDay(), shift: null };
  }

  if (preferredShift) {
    return {
      computed: onePunchComputedForShift(punchTime, preferredShift),
      shift: preferredShift,
    };
  }

  const sessionForShift: PunchSession = {
    ...session,
    firstCheckIn: punchTime,
  };
  const shift = resolveShiftForSession(sessionForShift, shifts);

  let lateMinutes = 0;
  if (shift) {
    const startExpected = timeToMinutes(shift.start_time.slice(0, 5));
    const checkInMinutes = timeToMinutes(punchTime);
    lateMinutes = Math.max(
      0,
      checkInMinutes - startExpected - shift.late_grace_minutes,
    );
  }

  return {
    computed: {
      shiftType: shift?.name ?? null,
      expectedMinutes: null,
      totalMinutes: null,
      lateMinutes,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: false,
      notes: incompletePunchDay().notes,
    },
    shift,
  };
}

function onePunchComputedForShift(
  punchTime: string,
  shift: AttendanceShift,
): ComputedDay {
  const startExpected = timeToMinutes(shift.start_time.slice(0, 5));
  const checkInMinutes = timeToMinutes(punchTime);
  const lateMinutes = Math.max(
    0,
    checkInMinutes - startExpected - shift.late_grace_minutes,
  );

  return {
    shiftType: shift.name,
    expectedMinutes: null,
    totalMinutes: null,
    lateMinutes,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    deductionMinutes: 0,
    isAbsent: false,
    notes: incompletePunchDay().notes,
  };
}

export function computeDayRecordWithShift(
  session: PunchSession,
  shift: AttendanceShift,
): ComputedDay {
  const firstCheckIn = session.firstCheckIn;
  const lastCheckOut = session.lastCheckOut;
  const totalMinutes = calcSessionMinutes(session);

  if (!firstCheckIn || !lastCheckOut) {
    const punchTime = firstCheckIn ?? lastCheckOut;
    if (!punchTime) {
      return computeDayRecord({ firstCheckIn, lastCheckOut });
    }
    return onePunchComputedForShift(punchTime, shift);
  }

  if (firstCheckIn === lastCheckOut) {
    return onePunchComputedForShift(firstCheckIn, shift);
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
    if (shift.crosses_midnight) {
      const adjustedExpectedEnd = startExpected + shift.expected_minutes;
      let adjustedCheckout = checkOutMinutes;
      if (checkOutMinutes <= startExpected) {
        adjustedCheckout = checkOutMinutes + 24 * 60;
      }
      earlyLeaveMinutes = Math.max(
        0,
        adjustedExpectedEnd - adjustedCheckout - shift.early_leave_grace_minutes,
      );
    } else {
      const expectedEnd = minutesOnClock(startExpected + shift.expected_minutes);
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
  preferredShift: AttendanceShift | null = null,
): { computed: ComputedDay; shift: AttendanceShift | null } {
  const firstCheckIn = session.firstCheckIn;
  const lastCheckOut = session.lastCheckOut;

  if (!firstCheckIn && !lastCheckOut) {
    return {
      computed: computeDayRecord({ firstCheckIn, lastCheckOut }),
      shift: null,
    };
  }

  // Personal schedule: always match against that shift (skip nearest / full-time auto).
  if (preferredShift) {
    if (!firstCheckIn || !lastCheckOut || firstCheckIn === lastCheckOut) {
      return computeOnePunchRecord(session, shifts, preferredShift);
    }
    return {
      computed: computeDayRecordWithShift(session, preferredShift),
      shift: preferredShift,
    };
  }

  if (!firstCheckIn || !lastCheckOut) {
    return computeOnePunchRecord(session, shifts);
  }

  if (firstCheckIn === lastCheckOut) {
    return computeOnePunchRecord(session, shifts);
  }

  const totalMinutes = calcSessionMinutes(session);
  if (totalMinutes >= fullTimeConfig.thresholdMinutes) {
    const shift = resolveShiftForSession(session, shifts);
    return {
      computed: computeFullTimeRecord(session, fullTimeConfig, shift),
      shift,
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
