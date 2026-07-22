/**
 * Per-person custom work schedule helpers (client-safe).
 */
import type { AttendancePerson, AttendanceShift } from "@/types/db";

export const CUSTOM_SCHEDULE_SHIFT_NAME = "جدول مخصص";

/** Sentinel id — never persist as attendance_shifts FK. */
export const CUSTOM_SCHEDULE_SHIFT_ID_PREFIX = "custom:";

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "أحد" },
  { value: 1, label: "إثن" },
  { value: 2, label: "ثلا" },
  { value: 3, label: "أرب" },
  { value: 4, label: "خمي" },
  { value: 5, label: "جمع" },
  { value: 6, label: "سبت" },
] as const;

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
    work_days: person.custom_work_days,
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

/**
 * Form checkbox values → stored work_days.
 * All seven days selected → null (every day).
 */
export function normalizeWorkDaysSelection(
  days: Array<string | number>,
): number[] | null {
  const unique = [
    ...new Set(
      days
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ].sort((a, b) => a - b);
  if (unique.length === 7) return null;
  return unique;
}

function shiftsLookup(
  shifts:
    | Map<string, AttendanceShift>
    | AttendanceShift[]
    | Record<string, AttendanceShift>
    | null
    | undefined,
): Map<string, AttendanceShift> {
  if (!shifts) return new Map();
  if (shifts instanceof Map) return shifts;
  if (Array.isArray(shifts)) {
    return new Map(shifts.map((s) => [s.id, s]));
  }
  return new Map(Object.entries(shifts));
}

/**
 * Resolve effective work days for absent counting.
 * Custom schedule days win; else assigned shift; else active branch shifts
 * (one shift → its days; multiple → intersection; null = all days).
 */
export function resolvePersonWorkDays(
  person: Pick<
    AttendancePerson,
    | "custom_start_time"
    | "custom_end_time"
    | "custom_work_days"
    | "shift_id"
  >,
  shifts?:
    | Map<string, AttendanceShift>
    | AttendanceShift[]
    | Record<string, AttendanceShift>
    | null,
): number[] | null {
  if (personHasCustomSchedule(person)) {
    return person.custom_work_days ?? null;
  }
  const byId = shiftsLookup(shifts);
  if (person.shift_id) {
    const shift = byId.get(person.shift_id);
    if (shift) return shift.work_days ?? null;
  }
  return workDaysFromActiveBranchShifts([...byId.values()]);
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function workDaysAsSet(workDays: number[] | null | undefined): Set<number> {
  if (workDays == null) return new Set(ALL_WEEKDAYS);
  return new Set(workDays);
}

/**
 * Derive work days from active branch shifts when the person has no assignment.
 */
export function workDaysFromActiveBranchShifts(
  shifts: AttendanceShift[],
): number[] | null {
  const active = shifts.filter((s) => s.active);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0].work_days ?? null;

  let intersection = workDaysAsSet(active[0].work_days);
  for (let i = 1; i < active.length; i += 1) {
    const next = workDaysAsSet(active[i].work_days);
    intersection = new Set([...intersection].filter((d) => next.has(d)));
  }
  if (intersection.size === 7) return null;
  return [...intersection].sort((a, b) => a - b);
}

export function formatWorkDaysLabel(
  workDays: number[] | null | undefined,
): string {
  if (workDays == null) return "كل الأيام";
  if (workDays.length === 0) return "لا أيام";
  const labels = WEEKDAY_OPTIONS.filter((d) => workDays.includes(d.value)).map(
    (d) => d.label,
  );
  return labels.join("، ");
}

export function formatPersonCustomScheduleLabel(
  person: Pick<AttendancePerson, "custom_start_time" | "custom_end_time">,
): string | null {
  if (!personHasCustomSchedule(person)) return null;
  return `${CUSTOM_SCHEDULE_SHIFT_NAME} ${person.custom_start_time!.slice(0, 5)}–${person.custom_end_time!.slice(0, 5)}`;
}
