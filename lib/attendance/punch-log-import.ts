import "server-only";

import type { AttendancePerson, AttendanceShift } from "@/types/db";
import {
  buildSessionsFromPunches,
  highPunchCountWarning,
  type PunchSession,
} from "@/lib/attendance/punch-sessions";
import { parseHikvisionMonthGridWorkbook } from "@/lib/attendance/hikvision-month-grid-parser";
import {
  parseRawPunchLogWorkbook,
  type RawPunchBlock,
} from "@/lib/attendance/raw-punch-log-parser";
import {
  computeSessionRecord,
  type FullTimeConfig,
} from "@/lib/attendance/shift-matching";
import {
  customSchedulePayloadSnapshot,
  isSyntheticCustomShiftId,
  personToSyntheticShift,
} from "@/lib/attendance/person-schedule";
import { type MatchedImportRow } from "@/lib/attendance/raw-excel-parser";
import {
  rosterEntriesFromBlocks,
  type ImportRosterEntry,
} from "@/lib/attendance/import-roster";

function sessionToDayRow(
  block: RawPunchBlock,
  session: PunchSession,
  person: AttendancePerson | null,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig,
): MatchedImportRow {
  const isNewPerson = !person;
  const preferredShift = person ? personToSyntheticShift(person) : null;
  const { computed, shift } = computeSessionRecord(
    session,
    shifts,
    fullTimeConfig,
    preferredShift,
  );
  const persistedShiftId =
    shift && !isSyntheticCustomShiftId(shift.id) ? shift.id : null;

  return {
    date: session.shiftDate,
    dayName: null,
    firstCheckIn: session.firstCheckIn,
    lastCheckOut: session.lastCheckOut,
    totalTime: null,
    externalEmployeeNumber: block.externalEmployeeNumber,
    employeeName: person?.full_name ?? block.employeeName,
    departmentHint: block.departmentHint,
    attendancePersonId: person?.id ?? null,
    isNewPerson,
    computed,
    totalMinutes: computed.totalMinutes,
    shiftId: persistedShiftId,
    punchCount: session.punchCount,
    rawPayload: {
      punch_count: session.punchCount,
      all_punch_times: session.allPunchTimes,
      first_punch_date: session.firstPunchDate,
      last_punch_date: session.lastPunchDate,
      selected_check_in: session.firstCheckIn
        ? { date: session.firstPunchDate, time: session.firstCheckIn }
        : null,
      selected_check_out: session.lastCheckOut
        ? { date: session.lastPunchDate, time: session.lastCheckOut }
        : null,
      ...(preferredShift && person
        ? { custom_schedule: customSchedulePayloadSnapshot(person) }
        : {}),
    },
  };
}

export async function matchPunchLogToAttendancePeople(
  blocks: RawPunchBlock[],
  peopleByExternal: Map<string, AttendancePerson>,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig,
): Promise<{
  rows: MatchedImportRow[];
  warnings: string[];
  rosterEntries: ImportRosterEntry[];
}> {
  const rows: MatchedImportRow[] = [];
  const warnings: string[] = [];
  const rosterEntries = rosterEntriesFromBlocks(blocks, peopleByExternal);

  for (const block of blocks) {
    const ext = block.externalEmployeeNumber?.trim();
    if (!ext) {
      warnings.push(`كتلة بدون رقم موظف: ${block.employeeName || "غير معروف"}`);
      continue;
    }
    if (!block.employeeName?.trim()) {
      warnings.push(`رقم ${ext}: الاسم فارغ`);
    }

    const person = peopleByExternal.get(ext) ?? null;
    const { sessions } = buildSessionsFromPunches(block.punches);

    for (const session of sessions) {
      const warn = highPunchCountWarning(
        ext,
        person?.full_name ?? block.employeeName,
        session,
      );
      if (warn) warnings.push(warn);

      if (session.mergedSessionCount && session.mergedSessionCount > 1) {
        warnings.push(
          `رقم ${ext} (${person?.full_name ?? block.employeeName}) — ${session.shiftDate}: تم دمج ${session.mergedSessionCount} فترات عمل متباعدة في يوم واحد (مراجعة يدوية موصى بها)`,
        );
      }

      rows.push(
        sessionToDayRow(block, session, person, shifts, fullTimeConfig),
      );
    }
  }

  return { rows, warnings, rosterEntries };
}

export async function parseAndMatchPunchLogWorkbook(
  buffer: ArrayBuffer,
  peopleByExternal: Map<string, AttendancePerson>,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig,
): Promise<{
  rows: MatchedImportRow[];
  warnings: string[];
  rosterEntries: ImportRosterEntry[];
}> {
  const parsed = await parseRawPunchLogWorkbook(buffer);
  const matched = await matchPunchLogToAttendancePeople(
    parsed.blocks,
    peopleByExternal,
    shifts,
    fullTimeConfig,
  );
  return {
    rows: matched.rows,
    warnings: [...parsed.warnings, ...matched.warnings],
    rosterEntries: matched.rosterEntries,
  };
}

export async function parseAndMatchHikvisionMonthGridWorkbook(
  buffer: ArrayBuffer,
  peopleByExternal: Map<string, AttendancePerson>,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig,
): Promise<{
  rows: MatchedImportRow[];
  warnings: string[];
  rosterEntries: ImportRosterEntry[];
}> {
  const parsed = await parseHikvisionMonthGridWorkbook(buffer);
  const matched = await matchPunchLogToAttendancePeople(
    parsed.blocks,
    peopleByExternal,
    shifts,
    fullTimeConfig,
  );
  return {
    rows: matched.rows,
    warnings: [...parsed.warnings, ...matched.warnings],
    rosterEntries: matched.rosterEntries,
  };
}

export { parseRawPunchLogWorkbook };
