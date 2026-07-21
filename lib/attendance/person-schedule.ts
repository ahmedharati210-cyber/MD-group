/**
 * Per-person custom work schedule helpers (client-safe).
 */
import type { AttendancePerson, AttendanceShift } from "@/types/db";

export const CUSTOM_SCHEDULE_SHIFT_NAME = "جدول مخصص";

/** Sentinel id — never persist as attendance_shifts FK. */
export const CUSTOM_SCHEDULE_SHIFT_ID_PREFIX = "custom:";

export function personHasCustomSchedule(
  person: Pick<AttendancePerson, "custom_start_time" | "custom_end_time"> | null | undefined,
): boolean {
  if (!person) return false;
  const start = person.custom_start_time?.slice(0, 5);
  const end = person.custom_end_time?.slice(0, 5);
  return Boolean(start && end);
}

function parseHm(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function expectedMinutesFromRange(
  start: string,
  end: string,
  crossesMidnight: boolean,
): number {
  let startM = parseHm(start);
  let endM = parseHm(end);
  if (crossesMidnight || endM <= startM) endM += 24 * 60;
  return Math.max(0, endM - startM);
}

/**
 * Build an in-memory shift from the person's custom times.
 * Do not write `shift.id` to attendance_monthly_records.shift_id.
 */
export function personToSyntheticShift(
  person: AttendancePerson,
): AttendanceShift | null {
  if (!personHasCustomSchedule(person)) return null;

  const start = person.custom_start_time!.slice(0, 5);
  const end = person.custom_end_time!.slice(0, 5);
  const crosses = person.custom_crosses_midnight ?? false;

  return {
    id: `${CUSTOM_SCHEDULE_SHIFT_ID_PREFIX}${person.id}`,
    company_id: person.company_id,
    branch_id: person.branch_id,
    name: CUSTOM_SCHEDULE_SHIFT_NAME,
    start_time: start,
    end_time: end,
    crosses_midnight: crosses,
    checkout_cutoff_time: null,
    expected_minutes: expectedMinutesFromRange(start, end, crosses),
    late_grace_minutes: person.custom_late_grace_minutes ?? 15,
    early_leave_grace_minutes: person.custom_early_leave_grace_minutes ?? 15,
    check_in_window_start: null,
    check_in_window_end: null,
    check_out_window_start: null,
    check_out_window_end: null,
    active: true,
    display_order: 0,
    created_at: person.created_at,
  };
}

export function isSyntheticCustomShiftId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(CUSTOM_SCHEDULE_SHIFT_ID_PREFIX));
}

/** Snapshot for raw_payload audit when matching against a personal schedule. */
export function customSchedulePayloadSnapshot(person: AttendancePerson): Record<string, unknown> {
  return {
    person_id: person.id,
    start_time: person.custom_start_time?.slice(0, 5) ?? null,
    end_time: person.custom_end_time?.slice(0, 5) ?? null,
    crosses_midnight: person.custom_crosses_midnight ?? false,
    late_grace_minutes: person.custom_late_grace_minutes ?? 15,
    early_leave_grace_minutes: person.custom_early_leave_grace_minutes ?? 15,
    work_days: person.custom_work_days,
  };
}

/**
 * Whether a calendar date is a scheduled work day for this person.
 * null work_days = all days; empty array = none.
 */
export function isPersonWorkDay(
  date: string,
  workDays: number[] | null | undefined,
): boolean {
  if (workDays == null) return true;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return workDays.includes(weekday);
}

export function formatPersonCustomScheduleLabel(
  person: Pick<AttendancePerson, "custom_start_time" | "custom_end_time">,
): string | null {
  if (!personHasCustomSchedule(person)) return null;
  return `${CUSTOM_SCHEDULE_SHIFT_NAME} ${person.custom_start_time!.slice(0, 5)}–${person.custom_end_time!.slice(0, 5)}`;
}
