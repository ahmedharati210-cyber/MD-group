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
const FALLBACK_EARLY_LEAVE_GRACE_MINUTES = 15;

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

/**
 * Nearest shift by END for a full-time checkout, considering only shifts
 * whose end has not already passed relative to the checkout (a shift already
 * finished can't be "left early" from). Returns null when no active shifts
 * exist at all (caller falls back to the 09:00 synthetic window), or when
 * checkout is at/after every active shift's own end (genuinely not early).
 */
function resolveShiftForFullTimeCheckout(
  checkoutMinutes: number,
  shiftDate: string,
  shifts: AttendanceShift[],
): { shift: AttendanceShift | null; hasActiveShifts: boolean } {
  const active = shifts.filter(
    (s) => s.active && isPersonWorkDay(shiftDate, s.work_days),
  );
  if (active.length === 0) return { shift: null, hasActiveShifts: false };

  let best: AttendanceShift | null = null;
  let bestDist = Infinity;
  for (const shift of active) {
    if (punchIsAfterExpectedEnd(checkoutMinutes, shift)) continue;
    const startMinutes = timeToMinutes(shift.start_time.slice(0, 5));
    const endMinutes = minutesOnClock(startMinutes + shift.expected_minutes);
    const dist = circularDistance(checkoutMinutes, endMinutes);
    if (dist < bestDist) {
      bestDist = dist;
      best = shift;
    }
  }
  return { shift: best, hasActiveShifts: true };
}

/**
 * Early leave for full-time days: vs the nearest unpassed shift's own end.
 * Used for reporting; deductions still use shortfall.
 */
function computeEarlyLeaveMinutesForFullTime(
  lastCheckOut: string | null,
  expectedMinutes: number,
  checkoutShift: AttendanceShift | null,
  hasActiveShifts: boolean,
): number {
  if (!lastCheckOut) return 0;
  let checkOutMinutes = timeToMinutes(lastCheckOut);

  if (checkoutShift) {
    const startExpected = timeToMinutes(checkoutShift.start_time.slice(0, 5));
    const expectedEnd = startExpected + checkoutShift.expected_minutes;
    if (checkOutMinutes <= startExpected) checkOutMinutes += 24 * 60;
    return Math.max(
      0,
      expectedEnd - checkOutMinutes - checkoutShift.early_leave_grace_minutes,
    );
  }

  if (hasActiveShifts) return 0; // checked out at/after every real shift's end

  // No shifts configured: fall back to synthetic 09:00 + expectedMinutes window.
  const expectedEnd = FALLBACK_START_MINUTES + expectedMinutes;
  if (checkOutMinutes <= FALLBACK_START_MINUTES) checkOutMinutes += 24 * 60;
  return Math.max(
    0,
    expectedEnd - checkOutMinutes - FALLBACK_EARLY_LEAVE_GRACE_MINUTES,
  );
}

function computeFullTimeRecord(
  session: PunchSession,
  config: FullTimeConfig,
  shifts: AttendanceShift[],
  lateShift: AttendanceShift | null,
): ComputedDay {
  const totalMinutes = calcSessionMinutes(session);
  const expectedMinutes = config.expectedMinutes;
  const lateMinutes = computeLateMinutesForFullTime(
    session.firstCheckIn,
    lateShift,
  );

  const checkoutMinutes = session.lastCheckOut
    ? timeToMinutes(session.lastCheckOut)
    : null;
  const { shift: checkoutShift, hasActiveShifts } =
    checkoutMinutes != null
      ? resolveShiftForFullTimeCheckout(
          checkoutMinutes,
          session.shiftDate,
          shifts,
        )
      : { shift: null, hasActiveShifts: false };
  const earlyLeaveMinutes = computeEarlyLeaveMinutesForFullTime(
    session.lastCheckOut,
    expectedMinutes,
    checkoutShift,
    hasActiveShifts,
  );
  const overtimeMinutes = Math.max(0, totalMinutes - expectedMinutes);
  // Shortfall alone — late/early are display-only; adding late would double-count.
  const shortfallMinutes = Math.max(0, expectedMinutes - totalMinutes);
  const deductionMinutes = shortfallMinutes;

  return {
    shiftType: SHIFT_FULL,
    expectedMinutes,
    totalMinutes,
    lateMinutes,
    earlyLeaveMinutes,
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
 * True when a lone punch falls after this shift's expected end.
 * After-end punches must not be treated as early-leave checkouts.
 */
function punchIsAfterExpectedEnd(
  punchMinutes: number,
  shift: AttendanceShift,
): boolean {
  const startExpected = timeToMinutes(shift.start_time.slice(0, 5));
  const expectedEnd = startExpected + shift.expected_minutes;

  if (punchMinutes >= startExpected) {
    // Same clock-side as start; overnight expectedEnd is >= 24h so this is false.
    return punchMinutes > expectedEnd;
  }

  // Before start on the clock: only overnight shifts can still be "in window".
  if (expectedEnd > 24 * 60 || shift.crosses_midnight) {
    return punchMinutes + 24 * 60 > expectedEnd;
  }

  return false;
}

/**
 * Whether a lone punch reads as a check-in (near start) or check-out (near end).
 * Checkout is only valid when the punch is at or before the expected end.
 */
function classifyOnePunch(
  punchMinutes: number,
  shift: AttendanceShift,
): { isCheckout: boolean; distance: number } {
  const startMinutes = timeToMinutes(shift.start_time.slice(0, 5));
  const endMinutes = minutesOnClock(startMinutes + shift.expected_minutes);
  const distStart = circularDistance(punchMinutes, startMinutes);

  if (punchIsAfterExpectedEnd(punchMinutes, shift)) {
    return { isCheckout: false, distance: distStart };
  }

  const distEnd = circularDistance(punchMinutes, endMinutes);
  return distEnd < distStart
    ? { isCheckout: true, distance: distEnd }
    : { isCheckout: false, distance: distStart };
}

function onePunchMinutesForShift(
  punchMinutes: number,
  shift: AttendanceShift,
  isCheckout: boolean,
): { lateMinutes: number; earlyLeaveMinutes: number } {
  const startExpected = timeToMinutes(shift.start_time.slice(0, 5));
  if (isCheckout) {
    const expectedEnd = startExpected + shift.expected_minutes;
    let checkoutMinutes = punchMinutes;
    if (checkoutMinutes <= startExpected) checkoutMinutes += 24 * 60;
    return {
      lateMinutes: 0,
      earlyLeaveMinutes: Math.max(
        0,
        expectedEnd - checkoutMinutes - shift.early_leave_grace_minutes,
      ),
    };
  }
  return {
    lateMinutes: Math.max(
      0,
      punchMinutes - startExpected - shift.late_grace_minutes,
    ),
    earlyLeaveMinutes: 0,
  };
}

/**
 * Pick the active shift whose start or (valid) end is nearest the lone punch.
 * Checkout candidates are only scored when punch <= expected end.
 */
function resolveShiftForOnePunch(
  punchMinutes: number,
  shiftDate: string,
  shifts: AttendanceShift[],
): { shift: AttendanceShift; isCheckout: boolean } | null {
  const active = shifts.filter(
    (s) => s.active && isPersonWorkDay(shiftDate, s.work_days),
  );
  if (active.length === 0) return null;

  let best: AttendanceShift | null = null;
  let bestIsCheckout = false;
  let bestDist = Infinity;

  for (const shift of active) {
    const startMinutes = timeToMinutes(shift.start_time.slice(0, 5));
    const endMinutes = minutesOnClock(startMinutes + shift.expected_minutes);

    const distStart = circularDistance(punchMinutes, startMinutes);
    if (distStart < bestDist) {
      bestDist = distStart;
      best = shift;
      bestIsCheckout = false;
    }

    if (!punchIsAfterExpectedEnd(punchMinutes, shift)) {
      const distEnd = circularDistance(punchMinutes, endMinutes);
      if (distEnd < bestDist) {
        bestDist = distEnd;
        best = shift;
        bestIsCheckout = true;
      }
    }
  }

  return best ? { shift: best, isCheckout: bestIsCheckout } : null;
}

function onePunchResult(
  shift: AttendanceShift,
  punchMinutes: number,
  isCheckout: boolean,
): { computed: ComputedDay; shift: AttendanceShift } {
  const { lateMinutes, earlyLeaveMinutes } = onePunchMinutesForShift(
    punchMinutes,
    shift,
    isCheckout,
  );
  return {
    computed: {
      shiftType: shift.name,
      expectedMinutes: null,
      totalMinutes: null,
      lateMinutes,
      earlyLeaveMinutes,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: false,
      notes: incompletePunchDay().notes,
    },
    shift,
  };
}

/**
 * One-punch day: count late or early leave (whichever the punch is nearer),
 * but never deduct time.
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

  const punchMinutes = timeToMinutes(punchTime);

  // Preferred shift is ignored when the punch is after its expected end so we
  // can rematch (e.g. 18:41 after morning end → night late check-in).
  if (preferredShift && !punchIsAfterExpectedEnd(punchMinutes, preferredShift)) {
    const { isCheckout } = classifyOnePunch(punchMinutes, preferredShift);
    return onePunchResult(preferredShift, punchMinutes, isCheckout);
  }

  const resolved = resolveShiftForOnePunch(
    punchMinutes,
    session.shiftDate,
    shifts,
  );

  if (!resolved) {
    return {
      computed: {
        shiftType: null,
        expectedMinutes: null,
        totalMinutes: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        deductionMinutes: 0,
        isAbsent: false,
        notes: incompletePunchDay().notes,
      },
      shift: null,
    };
  }

  return onePunchResult(resolved.shift, punchMinutes, resolved.isCheckout);
}

function onePunchComputedForShift(
  punchTime: string,
  shift: AttendanceShift,
): ComputedDay {
  const punchMinutes = timeToMinutes(punchTime);
  // After-end on an explicit shift → force check-in (never 0/0 early-leave checkout).
  const isCheckout = punchIsAfterExpectedEnd(punchMinutes, shift)
    ? false
    : classifyOnePunch(punchMinutes, shift).isCheckout;
  const { lateMinutes, earlyLeaveMinutes } = onePunchMinutesForShift(
    punchMinutes,
    shift,
    isCheckout,
  );

  return {
    shiftType: shift.name,
    expectedMinutes: null,
    totalMinutes: null,
    lateMinutes,
    earlyLeaveMinutes,
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
      computed: computeFullTimeRecord(session, fullTimeConfig, shifts, shift),
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
