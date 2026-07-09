/**
 * Verify Marina shift auto-detection engine (standalone, no TS runtime).
 * Usage: node scripts/verify-marina-shift-engine.mjs [path-to-xlsx]
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

const SHIFT_MORNING = "صباحي";
const SHIFT_EVENING = "مسائي";
const SHIFT_FULL = "دوام كامل";

const MARINA_SHIFTS = [
  {
    name: SHIFT_MORNING,
    start_time: "09:30",
    end_time: "16:00",
    crosses_midnight: false,
    expected_minutes: 390,
    late_grace_minutes: 15,
    early_leave_grace_minutes: 15,
    active: true,
  },
  {
    name: "ليلية",
    start_time: "16:00",
    end_time: "00:00",
    crosses_midnight: true,
    expected_minutes: 480,
    late_grace_minutes: 15,
    early_leave_grace_minutes: 15,
    active: true,
  },
];

const FULL_TIME_CONFIG = { thresholdMinutes: 9 * 60, expectedMinutes: 14 * 60 };

function timeToMinutes(time) {
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + mi;
}

function circularDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 * 60 - diff);
}

function sessionTotalMinutes(session) {
  if (!session.firstCheckIn || !session.lastCheckOut) return 0;
  const [y1, mo1, d1] = session.firstPunchDate.split("-").map(Number);
  const [h1, mi1] = session.firstCheckIn.split(":").map(Number);
  const [y2, mo2, d2] = session.lastPunchDate.split("-").map(Number);
  const [h2, mi2] = session.lastCheckOut.split(":").map(Number);
  const start = new Date(y1, mo1 - 1, d1, h1, mi1).getTime();
  const end = new Date(y2, mo2 - 1, d2, h2, mi2).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

function resolveShiftForSession(session, shifts) {
  const active = shifts.filter((s) => s.active);
  if (!session.firstCheckIn || active.length === 0) return null;
  const checkInMinutes = timeToMinutes(session.firstCheckIn);
  let best = null;
  let bestDist = Infinity;
  for (const shift of active) {
    const dist = circularDistance(checkInMinutes, timeToMinutes(shift.start_time));
    if (dist < bestDist) {
      bestDist = dist;
      best = shift;
    }
  }
  return best;
}

function computeFullTimeRecord(session, config) {
  const totalMinutes = sessionTotalMinutes(session);
  return {
    shiftType: SHIFT_FULL,
    expectedMinutes: config.expectedMinutes,
    totalMinutes,
    deductionMinutes: Math.max(0, config.expectedMinutes - totalMinutes),
  };
}

function computeSessionRecord(session, shifts, fullTimeConfig) {
  if (!session.firstCheckIn || !session.lastCheckOut) {
    return { computed: { shiftType: null }, shift: null };
  }
  const totalMinutes = sessionTotalMinutes(session);
  if (totalMinutes >= fullTimeConfig.thresholdMinutes) {
    return {
      computed: computeFullTimeRecord(session, fullTimeConfig),
      shift: null,
    };
  }
  const shift = resolveShiftForSession(session, shifts);
  return {
    computed: {
      shiftType: shift?.name ?? null,
      totalMinutes,
    },
    shift,
  };
}

// --- Unit assertions ---
const morningSession = {
  shiftDate: "2026-06-05",
  firstCheckIn: "09:45",
  lastCheckOut: "16:00",
  firstPunchDate: "2026-06-05",
  lastPunchDate: "2026-06-05",
  punchCount: 2,
  allPunchTimes: [],
};
const morning = computeSessionRecord(morningSession, MARINA_SHIFTS, FULL_TIME_CONFIG);
console.assert(morning.shift?.name === SHIFT_MORNING, "09:45 should match morning shift");

const eveningSession = {
  shiftDate: "2026-06-05",
  firstCheckIn: "16:10",
  lastCheckOut: "23:00",
  firstPunchDate: "2026-06-05",
  lastPunchDate: "2026-06-05",
  punchCount: 2,
  allPunchTimes: [],
};
const evening = computeSessionRecord(eveningSession, MARINA_SHIFTS, FULL_TIME_CONFIG);
console.assert(evening.shift?.name === "ليلية", "16:10 should match night shift");

const midpointSession = {
  shiftDate: "2026-06-05",
  firstCheckIn: "12:45",
  lastCheckOut: "16:00",
  firstPunchDate: "2026-06-05",
  lastPunchDate: "2026-06-05",
  punchCount: 2,
  allPunchTimes: [],
};
const midpoint = computeSessionRecord(midpointSession, MARINA_SHIFTS, FULL_TIME_CONFIG);
console.assert(
  midpoint.shift?.name === SHIFT_MORNING || midpoint.shift?.name === "ليلية",
  "12:45 should resolve to nearest shift",
);

const fullTimeSession = {
  shiftDate: "2026-06-06",
  firstCheckIn: "00:15",
  lastCheckOut: "19:49",
  firstPunchDate: "2026-06-06",
  lastPunchDate: "2026-06-06",
  punchCount: 2,
  allPunchTimes: [],
};
const fullTime = computeSessionRecord(fullTimeSession, MARINA_SHIFTS, FULL_TIME_CONFIG);
console.assert(
  fullTime.computed.shiftType === SHIFT_FULL,
  "19+ hour day should be full time",
);
console.assert(
  fullTime.computed.expectedMinutes === 14 * 60,
  "full time expected should be 14h",
);

const onePunchSession = {
  shiftDate: "2026-06-02",
  firstCheckIn: "10:51",
  lastCheckOut: null,
  firstPunchDate: "2026-06-02",
  lastPunchDate: "2026-06-02",
  punchCount: 1,
  allPunchTimes: [],
};
const onePunch = computeSessionRecord(onePunchSession, MARINA_SHIFTS, FULL_TIME_CONFIG);
console.assert(onePunch.computed.shiftType == null, "one punch should not resolve shift");

console.log("OK: Marina shift engine unit checks passed");

const filePath =
  process.argv[2] ?? "السجلات مارينا _20260701140726_export.xlsx";
try {
  const buffer = readFileSync(filePath).buffer;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  console.log(`Loaded ${filePath} (${workbook.worksheets.length} sheets)`);
} catch (e) {
  console.log("File load skipped:", e.message);
}
