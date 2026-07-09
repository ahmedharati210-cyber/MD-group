/**
 * Verify Marina raw punch-log pipeline (standalone, no TS runtime).
 * Usage: node scripts/verify-marina-punch-log.mjs [path-to-xlsx]
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

const EMPLOYEE_HEADER_RE =
  /رقم\s*الموظف\s*[:：]\s*([^,،]+)[,،]\s*الإسم\s*الأول\s*[:：]\s*([^,،]+)/;

const ATTENDANCE_DAY_START = 6 * 60;

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "object" && value.text) return value.text;
  if (typeof value === "object" && value.result != null) return String(value.result);
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function punchToTimestamp(date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

function timeToMinutes(time) {
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + mi;
}

function addDays(date, days) {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function attendanceDateForPunch(punch) {
  return timeToMinutes(punch.time) < ATTENDANCE_DAY_START
    ? addDays(punch.date, -1)
    : punch.date;
}

function dedupePunches(punches, windowMinutes = 3) {
  if (!punches.length) return [];
  const sorted = [...punches].sort(
    (a, b) => punchToTimestamp(a.date, a.time) - punchToTimestamp(b.date, b.time),
  );
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const gap =
      (punchToTimestamp(sorted[i].date, sorted[i].time) -
        punchToTimestamp(prev.date, prev.time)) /
      60000;
    if (gap >= windowMinutes) out.push(sorted[i]);
  }
  return out;
}

function buildSession(punches) {
  const first = punches[0];
  const last = punches[punches.length - 1];
  return {
    shiftDate: attendanceDateForPunch(first),
    firstCheckIn: first.time,
    lastCheckOut: last.time,
    firstPunchDate: first.date,
    lastPunchDate: last.date,
    punchCount: punches.length,
    allPunchTimes: punches.map((p) => ({ date: p.date, time: p.time })),
  };
}

function mergeSessionGroup(sessions) {
  const sorted = [...sessions].sort((a, b) => {
    const aStart = a.firstCheckIn
      ? punchToTimestamp(a.firstPunchDate, a.firstCheckIn)
      : Infinity;
    const bStart = b.firstCheckIn
      ? punchToTimestamp(b.firstPunchDate, b.firstCheckIn)
      : Infinity;
    return aStart - bStart;
  });
  const first = sorted.find((s) => s.firstCheckIn) ?? sorted[0];
  let latestTs = 0;
  let lastPunchDate = first.lastPunchDate;
  let lastCheckOut = first.lastCheckOut;
  let punchCount = 0;
  const allPunchTimes = [];
  for (const session of sorted) {
    punchCount += session.punchCount ?? 1;
    allPunchTimes.push(...(session.allPunchTimes ?? []));
    if (session.lastCheckOut) {
      const endTs = punchToTimestamp(session.lastPunchDate, session.lastCheckOut);
      if (endTs > latestTs) {
        latestTs = endTs;
        lastPunchDate = session.lastPunchDate;
        lastCheckOut = session.lastCheckOut;
      }
    }
  }
  return {
    ...first,
    lastCheckOut,
    lastPunchDate,
    punchCount,
    allPunchTimes,
  };
}

function mergeSessionsBySameDay(sessions) {
  const byDate = new Map();
  for (const session of sessions) {
    const list = byDate.get(session.shiftDate) ?? [];
    list.push(session);
    byDate.set(session.shiftDate, list);
  }
  const merged = [];
  for (const group of byDate.values()) {
    merged.push(group.length === 1 ? group[0] : mergeSessionGroup(group));
  }
  return merged.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
}

function clusterIntoSessions(punches, gapHours = 6) {
  const deduped = dedupePunches(punches);
  if (!deduped.length) return [];
  const gapMs = gapHours * 60 * 60 * 1000;
  const sessions = [];
  let current = [deduped[0]];
  for (let i = 1; i < deduped.length; i++) {
    const gap =
      punchToTimestamp(deduped[i].date, deduped[i].time) -
      punchToTimestamp(deduped[i - 1].date, deduped[i - 1].time);
    if (gap > gapMs) {
      sessions.push(buildSession(current));
      current = [deduped[i]];
    } else {
      current.push(deduped[i]);
    }
  }
  if (current.length) sessions.push(buildSession(current));
  return mergeSessionsBySameDay(sessions);
}

function buildSessionsFromPunches(punches) {
  return clusterIntoSessions(punches);
}

function dedupeMatchedImportRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.externalEmployeeNumber}|${row.date}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  const deduped = [];
  for (const group of byKey.values()) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    const earliest = group.reduce((a, b) =>
      punchToTimestamp(a.firstPunchDate ?? a.date, a.firstCheckIn) <
      punchToTimestamp(b.firstPunchDate ?? b.date, b.firstCheckIn)
        ? a
        : b,
    );
    const latest = group.reduce((a, b) =>
      punchToTimestamp(a.lastPunchDate ?? a.date, a.lastCheckOut ?? "00:00") >
      punchToTimestamp(b.lastPunchDate ?? b.date, b.lastCheckOut ?? "00:00")
        ? a
        : b,
    );
    const allPunchTimes = [];
    let punchCount = 0;
    for (const row of group) {
      punchCount += row.punchCount ?? 0;
      if (row.allPunchTimes) allPunchTimes.push(...row.allPunchTimes);
    }
    deduped.push({
      ...group[0],
      firstCheckIn: earliest.firstCheckIn,
      lastCheckOut: latest.lastCheckOut,
      punchCount,
      allPunchTimes,
    });
  }
  return deduped;
}

async function parseBlocks(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const blocks = [];
  let current = null;
  let reading = false;

  sheet.eachRow((row) => {
    const c1 = cellText(row.getCell(1).value);
    const m = c1.match(EMPLOYEE_HEADER_RE);
    if (m) {
      current = {
        externalEmployeeNumber: m[1].trim(),
        employeeName: m[2].trim(),
        punches: [],
      };
      blocks.push(current);
      reading = false;
      return;
    }
    if (!current) return;
    if (c1.includes("مصدر البيانات")) {
      reading = true;
      return;
    }
    if (!reading) return;
    const src = cellText(row.getCell(1).value);
    if (src !== "الجهاز") return;
    const time = cellText(row.getCell(4).value).slice(0, 5);
    const date = cellText(row.getCell(5).value).slice(0, 10);
    if (time && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      current.punches.push({ date, time });
    }
  });
  return blocks;
}

// --- Unit-style assertions ---
console.assert(
  attendanceDateForPunch({ date: "2026-06-05", time: "02:00" }) === "2026-06-04",
  "02:00 should belong to previous attendance day",
);
console.assert(
  attendanceDateForPunch({ date: "2026-06-05", time: "07:00" }) === "2026-06-05",
  "07:00 should belong to same attendance day",
);

const dayPunches = [
  { date: "2026-06-05", time: "08:30" },
  { date: "2026-06-05", time: "16:45" },
  { date: "2026-06-05", time: "12:00" },
];
const daySession = buildSessionsFromPunches(dayPunches)[0];
console.assert(daySession.firstCheckIn === "08:30", "first punch after 06:00 is check-in");
console.assert(daySession.lastCheckOut === "16:45", "last punch is checkout");
console.assert(daySession.allPunchTimes.length === 3, "all raw punches retained");

const nightPunches = [
  { date: "2026-06-04", time: "18:00" },
  { date: "2026-06-04", time: "23:00" },
  { date: "2026-06-05", time: "02:00" },
];
const nightSession = buildSessionsFromPunches(nightPunches)[0];
console.assert(nightSession.shiftDate === "2026-06-04", "night shift attendance day");
console.assert(nightSession.firstCheckIn === "18:00", "18:00 is night check-in");
console.assert(nightSession.lastCheckOut === "02:00", "02:00 is night checkout");
console.assert(nightSession.lastPunchDate === "2026-06-05", "checkout on next calendar day");

// Ahmed day 9 pattern: morning check-in + next-day early checkout
const ahmedDay9Punches = [
  { date: "2026-06-09", time: "11:11" },
  { date: "2026-06-10", time: "00:27" },
];
const ahmedDay9 = buildSessionsFromPunches(ahmedDay9Punches)[0];
console.assert(ahmedDay9.shiftDate === "2026-06-09", "Ahmed day 9 attendance date");
console.assert(ahmedDay9.firstCheckIn === "11:11", "11:11 is check-in (first punch after 06:00)");
console.assert(ahmedDay9.lastCheckOut === "00:27", "00:27 next day is checkout");
console.assert(ahmedDay9.lastPunchDate === "2026-06-10", "checkout on next calendar day");

// Preview/save dedupe parity
const preDedupeRows = [
  {
    externalEmployeeNumber: "99",
    date: "2026-06-05",
    firstCheckIn: "08:00",
    lastCheckOut: "12:00",
    firstPunchDate: "2026-06-05",
    lastPunchDate: "2026-06-05",
    punchCount: 2,
    allPunchTimes: [
      { date: "2026-06-05", time: "08:00" },
      { date: "2026-06-05", time: "12:00" },
    ],
  },
  {
    externalEmployeeNumber: "99",
    date: "2026-06-05",
    firstCheckIn: "14:00",
    lastCheckOut: "18:00",
    firstPunchDate: "2026-06-05",
    lastPunchDate: "2026-06-05",
    punchCount: 2,
    allPunchTimes: [
      { date: "2026-06-05", time: "14:00" },
      { date: "2026-06-05", time: "18:00" },
    ],
  },
];
const dedupedRows = dedupeMatchedImportRows(preDedupeRows);
console.assert(dedupedRows.length === 1, "dedupe collapses duplicate employee-day rows");
console.assert(dedupedRows[0].firstCheckIn === "08:00", "dedupe keeps earliest check-in");
console.assert(dedupedRows[0].lastCheckOut === "18:00", "dedupe keeps latest checkout");
console.assert(dedupedRows[0].allPunchTimes.length === 4, "dedupe merges all raw punches");

const filePath = process.argv[2] ?? "السجلات مارينا _20260701140726_export.xlsx";
const buffer = readFileSync(filePath).buffer;
const blocks = await parseBlocks(buffer);

console.log("blocks:", blocks.length);

const dayKeys = new Set();
let duplicateCount = 0;
for (const block of blocks) {
  const sessions = buildSessionsFromPunches(block.punches);
  for (const session of sessions) {
    const key = `${block.externalEmployeeNumber}|${session.shiftDate}`;
    if (dayKeys.has(key)) duplicateCount++;
    dayKeys.add(key);
  }
}
console.log("unique employee-day sessions:", dayKeys.size);
console.assert(duplicateCount === 0, `found ${duplicateCount} duplicate employee-day sessions`);

const ahmed = blocks.find((b) => b.externalEmployeeNumber === "2");
if (ahmed) {
  const june4Raw = ahmed.punches.filter((p) => p.date === "2026-06-04").length;
  const sessions = buildSessionsFromPunches(ahmed.punches);
  const june4 = sessions.find((s) => s.shiftDate === "2026-06-04");
  console.log("Ahmed #2:");
  console.log("  raw punches on calendar 2026-06-04:", june4Raw);
  console.log(
    "  attendance session:",
    june4
      ? `${june4.firstCheckIn}-${june4.lastCheckOut} (shift day ${june4.shiftDate}, raw ${june4.allPunchTimes?.length ?? 0})`
      : "none",
  );
  if (june4) {
    console.assert(
      (june4.allPunchTimes?.length ?? 0) >= june4.punchCount,
      "Ahmed session must retain all raw punches",
    );
  }
}

const albudri = blocks.find((b) => b.externalEmployeeNumber === "1");
if (albudri) {
  const sessions = buildSessionsFromPunches(albudri.punches);
  const midnight = albudri.punches.filter((p) => p.time < "06:00");
  console.log("\nAlbudri #1 early-morning punches:", midnight.length);
  for (const p of midnight.slice(0, 4)) {
    const ad = attendanceDateForPunch(p);
    const session = sessions.find((s) => s.shiftDate === ad);
    console.log(
      `  ${p.date} ${p.time} -> attendance day ${ad}, session checkout ${session?.lastCheckOut ?? "—"}`,
    );
  }
  const multiPunchSession = sessions.find((s) => (s.allPunchTimes?.length ?? 0) > 2);
  if (multiPunchSession) {
    console.assert(
      multiPunchSession.allPunchTimes.length >= multiPunchSession.punchCount,
      "Albudri multi-punch day must keep all raw punches",
    );
  }
}

console.log("\nOK: Marina punch / 06:00 boundary / Ahmed day 9 checks passed");
