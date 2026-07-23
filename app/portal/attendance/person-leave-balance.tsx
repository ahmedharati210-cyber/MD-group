"use client";

import { useActionState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  ANNUAL_LEAVE_ENTITLEMENT,
  isBalanceExhausted,
  leaveBalanceLabel,
  SICK_LEAVE_ENTITLEMENT,
} from "@/lib/attendance/leave-balance";
import type { AttendancePerson } from "@/types/db";
import {
  resetPersonLeaveBalanceAction,
  type ActionState,
} from "./actions";
import { restoreScrollY, withPreservedScroll } from "./preserve-scroll";

type BalanceProps = {
  person: Pick<
    AttendancePerson,
    "annual_leave_remaining" | "sick_leave_remaining" | "leave_balance_reset_at"
  >;
  canReset?: boolean;
  personId?: string;
  className?: string;
};

function BalancePill({
  label,
  remaining,
  entitlement,
}: {
  label: string;
  remaining: number;
  entitlement: number;
}) {
  const exhausted = isBalanceExhausted(remaining);
  return (
    <span
      className={`inline-flex flex-col gap-0.5 rounded-xl border px-3 py-2 text-xs ${
        exhausted
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      }`}
    >
      <span className="font-semibold">{label}</span>
      <span className={exhausted ? "font-bold" : ""}>
        {leaveBalanceLabel(remaining, entitlement)}
      </span>
    </span>
  );
}

export function PersonLeaveBalanceBadges({
  person,
  canReset = false,
  personId,
  className = "",
}: BalanceProps) {
  const annual = person.annual_leave_remaining ?? ANNUAL_LEAVE_ENTITLEMENT;
  const sick = person.sick_leave_remaining ?? SICK_LEAVE_ENTITLEMENT;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <BalancePill
        label="إجازة سنوية"
        remaining={annual}
        entitlement={ANNUAL_LEAVE_ENTITLEMENT}
      />
      <BalancePill
        label="إجازة مرضية"
        remaining={sick}
        entitlement={SICK_LEAVE_ENTITLEMENT}
      />
      {canReset && personId ? (
        <ResetLeaveBalanceButton personId={personId} />
      ) : null}
    </div>
  );
}

export function CompactLeaveBalanceText({
  person,
}: {
  person: Pick<
    AttendancePerson,
    "annual_leave_remaining" | "sick_leave_remaining"
  >;
}) {
  const annual = person.annual_leave_remaining ?? ANNUAL_LEAVE_ENTITLEMENT;
  const sick = person.sick_leave_remaining ?? SICK_LEAVE_ENTITLEMENT;
  return (
    <span
      className={`text-[10px] font-semibold ${
        isBalanceExhausted(annual) || isBalanceExhausted(sick)
          ? "text-amber-700 dark:text-amber-300"
          : "text-gray-500"
      }`}
    >
      سنوية {annual}/{ANNUAL_LEAVE_ENTITLEMENT} · مرضية {sick}/
      {SICK_LEAVE_ENTITLEMENT}
    </span>
  );
}

function ResetLeaveBalanceButton({ personId }: { personId: string }) {
  const [state, action, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(resetPersonLeaveBalanceAction, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(state.message ?? "تمت إعادة تعيين الرصيد");
      restoreScrollY();
    }
  }, [state]);

  return (
    <form action={withPreservedScroll(action)} className="inline-flex">
      <input type="hidden" name="attendance_person_id" value={personId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(event) => {
          if (
            !window.confirm(
              `إعادة تعيين رصيد الإجازات إلى ${ANNUAL_LEAVE_ENTITLEMENT} سنوية و ${SICK_LEAVE_ENTITLEMENT} مرضية؟`,
            )
          ) {
            event.preventDefault();
          }
        }}
        className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
      >
        {pending ? "جاري التعيين…" : "إعادة تعيين الرصيد"}
      </button>
    </form>
  );
}
