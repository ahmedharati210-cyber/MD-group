"use client";

import { useActionState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  recalculateBranchMonthAction,
  type ActionState,
} from "./actions";
import { restoreScrollY, withPreservedScroll } from "./preserve-scroll";

type Props = {
  companyId: string;
  branchId: string;
  month: string;
};

export function RecalculateBranchMonthButton({
  companyId,
  branchId,
  month,
}: Props) {
  const [state, action, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(recalculateBranchMonthAction, undefined);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        state.message ??
          `تم إعادة احتساب ${state.updatedCount ?? 0} يومًا للفرع`,
      );
      restoreScrollY();
    }
  }, [state]);

  useEffect(() => {
    if (prevPending.current && !pending) {
      restoreScrollY();
    }
    prevPending.current = pending;
  }, [pending]);

  return (
    <form action={withPreservedScroll(action)} className="inline-flex">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "جاري إعادة الاحتساب…" : "إعادة احتساب الكل"}
      </button>
    </form>
  );
}
