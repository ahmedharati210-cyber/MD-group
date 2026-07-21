/**
 * Rebuild monthly day metrics from stored punches against a preferred (custom) shift.
 */
import {
  customSchedulePayloadSnapshot,
  isSyntheticCustomShiftId,
  personHasCustomSchedule,
  personToSyntheticShift,
} from "@/lib/attendance/person-schedule";
import { punchSessionFromRecord } from "@/lib/attendance/session-from-record";
import {
  computeSessionRecord,
  DEFAULT_FULL_TIME_CONFIG,
  type FullTimeConfig,
} from "@/lib/attendance/shift-matching";
import type {
  AttendanceMonthlyRecord,
  AttendancePerson,
  AttendanceShift,
} from "@/types/db";

export type RecalculateRecordSource = Pick<
  AttendanceMonthlyRecord,
  | "id"
  | "date"
  | "first_check_in"
  | "last_check_out"
  | "punch_count"
  | "leave_type"
  | "raw_payload"
>;

export type RecalculatedRecordPatch = {
  shift_id: string | null;
  total_minutes: number | null;
  shift_type: string | null;
  expected_minutes: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  deduction_minutes: number;
  is_absent: boolean;
  raw_payload: Record<string, unknown>;
};

/**
 * Skip leave rows and days with no reconstructible punch session.
 */
export function shouldSkipPersonMonthRecalculate(
  record: RecalculateRecordSource,
): boolean {
  if (record.leave_type) return true;
  const session = punchSessionFromRecord({
    date: record.date,
    first_check_in: record.first_check_in,
    last_check_out: record.last_check_out,
    punch_count: record.punch_count,
    raw_payload: record.raw_payload,
  });
  return session == null;
}

/**
 * Recompute one day. When the person has a custom schedule, it always wins.
 */
export function buildRecalculatedRecordPatch(
  record: RecalculateRecordSource,
  person: AttendancePerson,
  shifts: AttendanceShift[],
  fullTimeConfig: FullTimeConfig | null,
): RecalculatedRecordPatch | null {
  if (shouldSkipPersonMonthRecalculate(record)) return null;

  const session = punchSessionFromRecord({
    date: record.date,
    first_check_in: record.first_check_in,
    last_check_out: record.last_check_out,
    punch_count: record.punch_count,
    raw_payload: record.raw_payload,
  });
  if (!session) return null;

  const preferredShift = personHasCustomSchedule(person)
    ? personToSyntheticShift(person)
    : null;

  const { computed, shift } = computeSessionRecord(
    session,
    shifts,
    fullTimeConfig ?? DEFAULT_FULL_TIME_CONFIG,
    preferredShift,
  );

  const rawPayload: Record<string, unknown> = {
    ...(record.raw_payload ?? {}),
    first_punch_date: session.firstPunchDate,
    last_punch_date: session.lastPunchDate,
    selected_check_in: session.firstCheckIn
      ? { date: session.firstPunchDate, time: session.firstCheckIn }
      : null,
    selected_check_out: session.lastCheckOut
      ? { date: session.lastPunchDate, time: session.lastCheckOut }
      : null,
  };

  if (preferredShift) {
    rawPayload.custom_schedule = customSchedulePayloadSnapshot(person);
  }

  const resolvedShiftId =
    shift && !isSyntheticCustomShiftId(shift.id) ? shift.id : null;

  return {
    shift_id: resolvedShiftId,
    total_minutes: computed.totalMinutes,
    shift_type: computed.shiftType,
    expected_minutes: computed.expectedMinutes,
    late_minutes: computed.lateMinutes,
    early_leave_minutes: computed.earlyLeaveMinutes,
    overtime_minutes: computed.overtimeMinutes,
    deduction_minutes: computed.deductionMinutes,
    is_absent: computed.isAbsent,
    raw_payload: rawPayload,
  };
}
