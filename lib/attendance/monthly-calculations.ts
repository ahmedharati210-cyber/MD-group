import "server-only";

/** Arabic shift labels matching the Dolce monthly report workbook. */
export const SHIFT_MORNING = "صباحي";
export const SHIFT_EVENING = "مسائي";
export const SHIFT_FULL = "دوام كامل";

export const EXPECTED_MINUTES: Record<string, number> = {
  [SHIFT_MORNING]: 5 * 60 + 30,
  [SHIFT_EVENING]: 6 * 60,
  [SHIFT_FULL]: 14 * 60,
};

export type FullTimeRule = {
  thresholdMinutes: number;
  expectedMinutes: number;
};

export const DEFAULT_FULL_TIME_RULE: FullTimeRule = {
  thresholdMinutes: 9 * 60,
  expectedMinutes: 14 * 60,
};

const LATE_GRACE_MINUTES = 15;
const EARLY_GRACE_MINUTES = 15;

export type DayPunch = {
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  isHoliday?: boolean;
};

export type ComputedDay = {
  shiftType: string | null;
  expectedMinutes: number | null;
  totalMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  deductionMinutes: number;
  isAbsent: boolean;
  notes: string | null;
};

/** Single punch or identical in/out — no shift deductions. */
export function incompletePunchDay(): ComputedDay {
  return {
    shiftType: null,
    expectedMinutes: null,
    totalMinutes: null,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    deductionMinutes: 0,
    isAbsent: false,
    notes: "بصمة ناقصة",
  };
}

function parseTimeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function diffMinutes(start: string, end: string): number {
  const a = parseTimeToMinutes(start);
  const b = parseTimeToMinutes(end);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

export function resolveShiftType(
  firstCheckIn: string | null,
  lastCheckOut: string | null,
  fullTimeRule: FullTimeRule = DEFAULT_FULL_TIME_RULE,
): string | null {
  if (!firstCheckIn || !lastCheckOut) return null;
  const workedMinutes = diffMinutes(firstCheckIn, lastCheckOut);
  if (workedMinutes >= fullTimeRule.thresholdMinutes) return SHIFT_FULL;

  const hour = Number(firstCheckIn.split(":")[0]);
  if (hour >= 9 && hour < 14) return SHIFT_MORNING;
  if (hour >= 14 && hour < 23) return SHIFT_EVENING;
  return null;
}

function expectedStartMinutes(shiftType: string | null): number | null {
  if (shiftType === SHIFT_MORNING || shiftType === SHIFT_FULL) return 9 * 60;
  if (shiftType === SHIFT_EVENING) return 14 * 60;
  return null;
}

/**
 * Mirrors the polished monthly report formulas for shift, late, early, overtime.
 */
export function computeDayRecord(
  punch: DayPunch,
  fullTimeRule: FullTimeRule = DEFAULT_FULL_TIME_RULE,
): ComputedDay {
  if (punch.isHoliday) {
    return {
      shiftType: null,
      expectedMinutes: null,
      totalMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: false,
      notes: "عطلة",
    };
  }

  const { firstCheckIn, lastCheckOut } = punch;
  if (!firstCheckIn && !lastCheckOut) {
    return {
      shiftType: null,
      expectedMinutes: null,
      totalMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: true,
      notes: "غياب",
    };
  }

  if (!firstCheckIn || !lastCheckOut) {
    return incompletePunchDay();
  }

  if (firstCheckIn === lastCheckOut) {
    return incompletePunchDay();
  }

  const shiftType = resolveShiftType(firstCheckIn, lastCheckOut, fullTimeRule);
  const expectedMinutes =
    shiftType === SHIFT_FULL
      ? fullTimeRule.expectedMinutes
      : shiftType
        ? EXPECTED_MINUTES[shiftType] ?? null
        : null;
  const totalMinutes = diffMinutes(firstCheckIn, lastCheckOut);

  if (shiftType === SHIFT_FULL) {
    const checkInMinutes = parseTimeToMinutes(firstCheckIn);
    const startExpected = expectedStartMinutes(shiftType);
    let lateMinutes = 0;
    if (startExpected != null && checkInMinutes != null) {
      lateMinutes = Math.max(0, checkInMinutes - startExpected - LATE_GRACE_MINUTES);
    }
    const overtimeMinutes = Math.max(0, totalMinutes - fullTimeRule.expectedMinutes);
    // Shortfall alone — late is display-only; adding it would double-count.
    const shortfallMinutes = Math.max(0, fullTimeRule.expectedMinutes - totalMinutes);
    const deductionMinutes = shortfallMinutes;
    return {
      shiftType,
      expectedMinutes: fullTimeRule.expectedMinutes,
      totalMinutes,
      lateMinutes,
      earlyLeaveMinutes: 0,
      overtimeMinutes,
      deductionMinutes,
      isAbsent: false,
      notes: null,
    };
  }

  const startExpected = expectedStartMinutes(shiftType);
  const checkInMinutes = parseTimeToMinutes(firstCheckIn);
  const checkOutMinutes = parseTimeToMinutes(lastCheckOut);

  let lateMinutes = 0;
  if (startExpected != null && checkInMinutes != null) {
    lateMinutes = Math.max(0, checkInMinutes - startExpected - LATE_GRACE_MINUTES);
  }

  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  if (expectedMinutes != null && checkOutMinutes != null && checkInMinutes != null) {
    const expectedEnd = checkInMinutes + expectedMinutes;
    earlyLeaveMinutes = Math.max(
      0,
      expectedEnd - checkOutMinutes - EARLY_GRACE_MINUTES,
    );
    const delta = totalMinutes - expectedMinutes;
    if (delta > 0) overtimeMinutes = delta;
  }

  const deductionMinutes = lateMinutes + earlyLeaveMinutes;

  return {
    shiftType,
    expectedMinutes,
    totalMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    deductionMinutes,
    isAbsent: false,
    notes: null,
  };
}

export function formatMinutesAsHours(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}`;
}

export function formatOvertimeDisplay(
  totalMinutes: number | null,
  expectedMinutes: number | null,
): string {
  if (totalMinutes == null || expectedMinutes == null) return "";
  const delta = totalMinutes - expectedMinutes;
  if (delta === 0) return "0:00";
  const formatted = formatMinutesAsHours(delta);
  return delta > 0 ? `+${formatted.replace(/^-/, "")}` : formatted;
}

export function monthFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function enumerateMonthDays(year: number, month: number): string[] {
  const count = daysInMonth(year, month);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${prefix}-${day}`;
  });
}

export function parseMonthParam(value: string): { year: number; month: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export { minutesToTime, parseTimeToMinutes };
