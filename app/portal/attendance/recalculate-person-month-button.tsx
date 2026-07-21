"use client";

import { useActionState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import {
  recalculatePersonMonthAction,
  type ActionState,
} from "./actions";

type Props = {
  personId: string;
  companyId: string;
  branchId: string;
  month: string;
};

export function RecalculatePersonMonthButton({
  personId,
  companyId,
  branchId,
  month,
}: Props) {
  const [state, action, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(recalculatePersonMonthAction, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) {
      toast.success(
        state.message ??
          `تم إعادة احتساب ${state.updatedCount ?? 0} يومًا بالجدول المخصص`,
      );
    }
  }, [state]);

  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="attendance_person_id" value={personId} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
      >
        <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "جاري إعادة الاحتساب…" : "إعادة احتساب بالجدول المخصص"}
      </button>
    </form>
  );
}
