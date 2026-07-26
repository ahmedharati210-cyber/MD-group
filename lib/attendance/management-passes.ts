/**
 * Per-day management passes that waive late / early-leave penalties.
 * Flags live in attendance_monthly_records.raw_payload.
 */
import type { ComputedDay } from "@/lib/attendance/monthly-calculations";

// Mirrors SHIFT_FULL from monthly-calculations.ts. Duplicated as a plain
// string (not imported) because that module has `import "server-only"` and
// this file is bundled into client components (attendance-record-edit-row).
const SHIFT_FULL = "دوام كامل";

export const WAIVE_LATE_KEY = "waive_late";
export const WAIVE_EARLY_LEAVE_KEY = "waive_early_leave";

export type ManagementPasses = {
  waiveLate: boolean;
  waiveEarlyLeave: boolean;
};

export function readManagementPasses(
  rawPayload: Record<string, unknown> | null | undefined,
): ManagementPasses {
  return {
    waiveLate: rawPayload?.[WAIVE_LATE_KEY] === true,
    waiveEarlyLeave: rawPayload?.[WAIVE_EARLY_LEAVE_KEY] === true,
  };
}

/** Parse checkbox / form values into pass flags. */
export function parseManagementPassesFromForm(formData: FormData): ManagementPasses {
  const late = formData.get("waive_late");
  const early = formData.get("waive_early_leave");
  return {
    waiveLate: late === "true" || late === "on" || late === "1",
    waiveEarlyLeave: early === "true" || early === "on" || early === "1",
  };
}

/**
 * Merge pass flags into raw_payload (omit keys when false).
 */
export function mergeManagementPassesIntoPayload(
  rawPayload: Record<string, unknown>,
  passes: ManagementPasses,
): Record<string, unknown> {
  const next = { ...rawPayload };
  if (passes.waiveLate) next[WAIVE_LATE_KEY] = true;
  else delete next[WAIVE_LATE_KEY];
  if (passes.waiveEarlyLeave) next[WAIVE_EARLY_LEAVE_KEY] = true;
  else delete next[WAIVE_EARLY_LEAVE_KEY];
  return next;
}

/**
 * Zero waived late/early minutes and subtract them from deduction for
 * regular shifts. Full-time deduction is shortfall-only, so waivers must
 * not reduce it (late/early are display-only there).
 */
export function applyManagementPasses(
  computed: ComputedDay,
  passes: ManagementPasses,
): ComputedDay {
  if (!passes.waiveLate && !passes.waiveEarlyLeave) return computed;

  const waivedLate = passes.waiveLate ? computed.lateMinutes : 0;
  const waivedEarly = passes.waiveEarlyLeave ? computed.earlyLeaveMinutes : 0;
  const isFullTime = computed.shiftType === SHIFT_FULL;

  return {
    ...computed,
    lateMinutes: passes.waiveLate ? 0 : computed.lateMinutes,
    earlyLeaveMinutes: passes.waiveEarlyLeave ? 0 : computed.earlyLeaveMinutes,
    deductionMinutes: isFullTime
      ? computed.deductionMinutes
      : Math.max(0, computed.deductionMinutes - waivedLate - waivedEarly),
  };
}

export function hasActiveManagementPass(
  rawPayload: Record<string, unknown> | null | undefined,
): boolean {
  const passes = readManagementPasses(rawPayload);
  return passes.waiveLate || passes.waiveEarlyLeave;
}
