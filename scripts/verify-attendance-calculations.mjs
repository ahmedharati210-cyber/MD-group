/**
 * Verifies monthly attendance calculation formulas (standalone, no Next.js runtime).
 * Usage: node scripts/verify-attendance-calculations.mjs
 */

const SHIFT_MORNING = "صباحي";
const SHIFT_EVENING = "مسائي";
const SHIFT_FULL = "دوام كامل";
const EXPECTED_MINUTES = {
  [SHIFT_MORNING]: 5 * 60 + 30,
  [SHIFT_EVENING]: 6 * 60,
  [SHIFT_FULL]: 14 * 60,
};
const FULL_TIME_RULE = { thresholdMinutes: 9 * 60, expectedMinutes: 14 * 60 };
const LATE_GRACE_MINUTES = 15;
const EARLY_GRACE_MINUTES = 15;

function parseTimeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function diffMinutes(start, end) {
  const a = parseTimeToMinutes(start);
  const b = parseTimeToMinutes(end);
  if (a == null || b == null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function resolveShiftType(firstCheckIn, lastCheckOut) {
  if (!firstCheckIn || !lastCheckOut) return null;
  const workedHours = diffMinutes(firstCheckIn, lastCheckOut) / 60;
  if (workedHours >= 9) return SHIFT_FULL;
  const hour = Number(firstCheckIn.split(":")[0]);
  if (hour >= 9 && hour < 14) return SHIFT_MORNING;
  if (hour >= 14 && hour < 23) return SHIFT_EVENING;
  return null;
}

function expectedStartMinutes(shiftType) {
  if (shiftType === SHIFT_MORNING || shiftType === SHIFT_FULL) return 9 * 60;
  if (shiftType === SHIFT_EVENING) return 14 * 60;
  return null;
}

function computeDayRecord(punch) {
  if (punch.isHoliday) {
    return { shiftType: null, lateMinutes: 0, isAbsent: false, notes: "عطلة" };
  }
  const { firstCheckIn, lastCheckOut } = punch;
  if (!firstCheckIn && !lastCheckOut) {
    return { shiftType: null, lateMinutes: 0, isAbsent: true, notes: "غياب" };
  }
  if (!firstCheckIn || !lastCheckOut) {
    return { shiftType: null, lateMinutes: 0, isAbsent: false, notes: "بصمة ناقصة" };
  }
  const shiftType = resolveShiftType(firstCheckIn, lastCheckOut);
  const totalMinutes = diffMinutes(firstCheckIn, lastCheckOut);

  if (shiftType === SHIFT_FULL) {
    return {
      shiftType,
      expectedMinutes: FULL_TIME_RULE.expectedMinutes,
      totalMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      deductionMinutes: Math.max(0, FULL_TIME_RULE.expectedMinutes - totalMinutes),
      isAbsent: false,
      notes: null,
    };
  }

  const expectedMinutes = shiftType ? EXPECTED_MINUTES[shiftType] ?? null : null;
  const startExpected = expectedStartMinutes(shiftType);
  const checkInMinutes = parseTimeToMinutes(firstCheckIn);
  const checkOutMinutes = parseTimeToMinutes(lastCheckOut);
  let lateMinutes = 0;
  if (startExpected != null && checkInMinutes != null) {
    lateMinutes = Math.max(0, checkInMinutes - startExpected - LATE_GRACE_MINUTES);
  }
  let earlyLeaveMinutes = 0;
  if (expectedMinutes != null && checkOutMinutes != null && checkInMinutes != null) {
    const expectedEnd = checkInMinutes + expectedMinutes;
    earlyLeaveMinutes = Math.max(0, expectedEnd - checkOutMinutes - EARLY_GRACE_MINUTES);
  }
  return {
    shiftType,
    lateMinutes,
    earlyLeaveMinutes,
    isAbsent: false,
    notes: null,
    totalMinutes,
    expectedMinutes,
  };
}

const cases = [
  {
    label: "morning on-time",
    punch: { firstCheckIn: "09:00", lastCheckOut: "14:30" },
    expect: { shiftType: SHIFT_MORNING, lateMinutes: 0, isAbsent: false },
  },
  {
    label: "morning late 20min (after 15 grace)",
    punch: { firstCheckIn: "09:20", lastCheckOut: "14:30" },
    expect: { lateMinutes: 5 },
  },
  {
    label: "evening shift",
    punch: { firstCheckIn: "14:00", lastCheckOut: "20:00" },
    expect: { shiftType: SHIFT_EVENING },
  },
  {
    label: "full day 11.5h",
    punch: { firstCheckIn: "09:00", lastCheckOut: "20:30" },
    expect: { shiftType: SHIFT_FULL },
  },
  {
    label: "absent",
    punch: { firstCheckIn: null, lastCheckOut: null },
    expect: { isAbsent: true },
  },
  {
    label: "holiday",
    punch: { firstCheckIn: null, lastCheckOut: null, isHoliday: true },
    expect: { notes: "عطلة", isAbsent: false },
  },
  {
    label: "missing punch",
    punch: { firstCheckIn: "09:00", lastCheckOut: null },
    expect: { notes: "بصمة ناقصة" },
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const result = computeDayRecord(c.punch);
  let ok = true;
  for (const [key, value] of Object.entries(c.expect)) {
    if (result[key] !== value) {
      console.error(`FAIL ${c.label}: expected ${key}=${value}, got ${result[key]}`);
      ok = false;
    }
  }
  if (ok) {
    console.log(`OK   ${c.label}`);
    passed += 1;
  } else {
    failed += 1;
  }
}

console.log(`\nShift resolver smoke: 10h => ${resolveShiftType("09:00", "19:00")}`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
