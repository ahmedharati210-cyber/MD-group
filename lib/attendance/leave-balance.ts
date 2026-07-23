/**
 * Client-safe yearly / sick leave balance helpers for attendance people.
 */
import type { LeaveType } from "@/lib/attendance/leave-types";

export const ANNUAL_LEAVE_ENTITLEMENT = 14;
export const SICK_LEAVE_ENTITLEMENT = 4;

export const ANNUAL_LEAVE_TYPE = "إجازة سنوية" as const satisfies LeaveType;
export const SICK_LEAVE_TYPE = "إجازة مرضية" as const satisfies LeaveType;

export type LeaveBalancePool = "annual" | "sick";

export type LeaveBalanceDelta = {
  annual: number;
  sick: number;
};

export function leaveTypeToBalancePool(
  leaveType: string | null | undefined,
): LeaveBalancePool | null {
  if (leaveType === ANNUAL_LEAVE_TYPE) return "annual";
  if (leaveType === SICK_LEAVE_TYPE) return "sick";
  return null;
}

/**
 * Delta to apply to remaining balances when leave_type changes.
 * Negative = consume days; positive = restore days.
 */
export function balanceDeltaForLeaveChange(
  previousType: string | null | undefined,
  nextType: string | null | undefined,
): LeaveBalanceDelta {
  const delta: LeaveBalanceDelta = { annual: 0, sick: 0 };
  const prevPool = leaveTypeToBalancePool(previousType);
  const nextPool = leaveTypeToBalancePool(nextType);
  if (prevPool === nextPool) return delta;
  if (prevPool === "annual") delta.annual += 1;
  if (prevPool === "sick") delta.sick += 1;
  if (nextPool === "annual") delta.annual -= 1;
  if (nextPool === "sick") delta.sick -= 1;
  return delta;
}

export function isBalanceExhausted(remaining: number): boolean {
  return remaining <= 0;
}

export function hasLeaveBalanceDelta(delta: LeaveBalanceDelta): boolean {
  return delta.annual !== 0 || delta.sick !== 0;
}

export function formatLeaveBalanceWarning(args: {
  annualRemaining: number;
  sickRemaining: number;
  delta: LeaveBalanceDelta;
}): string | null {
  const parts: string[] = [];
  if (args.delta.annual < 0 && args.annualRemaining < 0) {
    parts.push(
      `تجاوز رصيد الإجازة السنوية (متبقي ${args.annualRemaining} من ${ANNUAL_LEAVE_ENTITLEMENT})`,
    );
  }
  if (args.delta.sick < 0 && args.sickRemaining < 0) {
    parts.push(
      `تجاوز رصيد الإجازة المرضية (متبقي ${args.sickRemaining} من ${SICK_LEAVE_ENTITLEMENT})`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function leaveBalanceLabel(
  remaining: number,
  entitlement: number,
): string {
  return `متبقي: ${remaining} من ${entitlement}`;
}
