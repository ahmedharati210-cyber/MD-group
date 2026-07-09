export type RawPunch = {
  date: string;
  time: string;
};

export type PunchSession = {
  /** Attendance day (06:00 boundary), not always calendar check-in date. */
  shiftDate: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  firstPunchDate: string;
  lastPunchDate: string;
  punchCount: number;
  allPunchTimes: Array<{ date: string; time: string }>;
  /** Set when multiple gap-separated stints on the same attendance day were merged. */
  mergedSessionCount?: number;
};

/** Attendance day rolls at 06:00 — punches before this belong to the previous day. */
export const ATTENDANCE_DAY_START_MINUTES = 6 * 60;

function punchToTimestamp(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

export function timeToMinutes(time: string): number {
  const [h, mi] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + mi;
}

function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nmo = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nmo}-${nd}`;
}

/**
 * Map a punch to its attendance date (day boundary at 06:00).
 */
export function attendanceDateForPunch(
  punch: RawPunch,
  dayStartMinutes = ATTENDANCE_DAY_START_MINUTES,
): string {
  const minutes = timeToMinutes(punch.time);
  if (minutes < dayStartMinutes) {
    return addDays(punch.date, -1);
  }
  return punch.date;
}

/**
 * Collapse duplicate Face-ID fires within a short window.
 */
export function dedupePunches(
  punches: RawPunch[],
  windowMinutes = 3,
): RawPunch[] {
  if (punches.length === 0) return [];

  const sorted = [...punches].sort(
    (a, b) => punchToTimestamp(a.date, a.time) - punchToTimestamp(b.date, b.time),
  );

  const deduped: RawPunch[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = sorted[i];
    const gap =
      (punchToTimestamp(curr.date, curr.time) -
        punchToTimestamp(prev.date, prev.time)) /
      60000;
    if (gap >= windowMinutes) {
      deduped.push(curr);
    }
  }
  return deduped;
}

/**
 * Group deduped punches into work sessions.
 * Uses 06:00 attendance-day boundary for shiftDate.
 */
export function clusterIntoSessions(
  punches: RawPunch[],
  gapHours = 6,
): PunchSession[] {
  const deduped = dedupePunches(punches);
  if (deduped.length === 0) return [];

  const gapMs = gapHours * 60 * 60 * 1000;
  const sessions: PunchSession[] = [];

  let currentPunches: RawPunch[] = [deduped[0]];

  for (let i = 1; i < deduped.length; i++) {
    const prev = deduped[i - 1];
    const curr = deduped[i];
    const gap =
      punchToTimestamp(curr.date, curr.time) -
      punchToTimestamp(prev.date, prev.time);

    if (gap > gapMs) {
      sessions.push(buildSession(currentPunches));
      currentPunches = [curr];
    } else {
      currentPunches.push(curr);
    }
  }

  if (currentPunches.length > 0) {
    sessions.push(buildSession(currentPunches));
  }

  return mergeSessionsBySameDay(sessions);
}

/**
 * Primary entry: first punch after 06:00 = check-in, last before next 06:00 = checkout.
 * Shift start_time is used only for lateness/deduction calculations downstream.
 */
export function buildSessionsFromPunches(
  punches: RawPunch[],
  _shift?: unknown,
): { sessions: PunchSession[]; warnings: string[] } {
  return { sessions: clusterIntoSessions(punches), warnings: [] };
}

/**
 * Collapse multiple sessions that share the same shiftDate into one row.
 */
export function mergeSessionsBySameDay(sessions: PunchSession[]): PunchSession[] {
  const byDate = new Map<string, PunchSession[]>();
  for (const session of sessions) {
    const list = byDate.get(session.shiftDate) ?? [];
    list.push(session);
    byDate.set(session.shiftDate, list);
  }

  const merged: PunchSession[] = [];
  for (const group of byDate.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
    } else {
      merged.push(mergeSessionGroup(group));
    }
  }

  return merged.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
}

function mergeSessionGroup(sessions: PunchSession[]): PunchSession {
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
  const allPunchTimes: Array<{ date: string; time: string }> = [];
  let punchCount = 0;

  for (const session of sorted) {
    allPunchTimes.push(...session.allPunchTimes);
    punchCount += session.punchCount;
    if (session.lastCheckOut) {
      const endTs = punchToTimestamp(session.lastPunchDate, session.lastCheckOut);
      if (endTs > latestTs) {
        latestTs = endTs;
        lastPunchDate = session.lastPunchDate;
        lastCheckOut = session.lastCheckOut;
      }
    }
  }

  allPunchTimes.sort(
    (a, b) => punchToTimestamp(a.date, a.time) - punchToTimestamp(b.date, b.time),
  );

  return {
    shiftDate: first.shiftDate,
    firstCheckIn: first.firstCheckIn,
    lastCheckOut,
    firstPunchDate: first.firstPunchDate,
    lastPunchDate,
    punchCount,
    allPunchTimes,
    mergedSessionCount: sorted.length,
  };
}

function buildSession(punches: RawPunch[]): PunchSession {
  const first = punches[0];
  const last = punches[punches.length - 1];
  const shiftDate = attendanceDateForPunch(first);
  return {
    shiftDate,
    firstCheckIn: first.time,
    lastCheckOut: last.time,
    firstPunchDate: first.date,
    lastPunchDate: last.date,
    punchCount: punches.length,
    allPunchTimes: punches.map((p) => ({ date: p.date, time: p.time })),
  };
}

export function sessionTotalMinutes(session: PunchSession): number {
  if (!session.firstCheckIn || !session.lastCheckOut) return 0;
  const start = punchToTimestamp(session.firstPunchDate, session.firstCheckIn);
  const end = punchToTimestamp(session.lastPunchDate, session.lastCheckOut);
  return Math.max(0, Math.round((end - start) / 60000));
}

export function highPunchCountWarning(
  externalEmployeeNumber: string,
  employeeName: string,
  session: PunchSession,
  threshold = 12,
): string | null {
  if (session.punchCount <= threshold) return null;
  return `رقم ${externalEmployeeNumber} (${employeeName}) — ${session.shiftDate}: ${session.punchCount} بصمة (مراجعة يدوية)`;
}
