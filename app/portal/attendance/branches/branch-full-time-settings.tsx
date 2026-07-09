"use client";

import { useActionState } from "react";
import type { AttendanceBranch } from "@/types/db";
import {
  updateAttendanceBranchFullTimeRuleAction,
  type ActionState,
} from "../actions";

type Props = {
  branch: AttendanceBranch;
};

export function BranchFullTimeSettings({ branch }: Props) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateAttendanceBranchFullTimeRuleAction,
    undefined,
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-8">
      <h3 className="font-bold mb-1">قواعد الدوام الكامل — {branch.name}</h3>
      <p className="text-sm text-gray-500 mb-4">
        إذا تجاوز إجمالي ساعات العمل في اليوم الحد، يُصنَّف كـ «دوام كامل» وتُحسب
        الساعات المطلوبة والخصم بناءً على ذلك.
      </p>
      <form action={action} className="grid gap-4 sm:grid-cols-3 items-end">
        <input type="hidden" name="branch_id" value={branch.id} />
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            حد الدوام الكامل (ساعة)
          </label>
          <input
            name="threshold_hours"
            type="number"
            min={1}
            max={24}
            required
            defaultValue={Math.round((branch.full_time_threshold_minutes ?? 540) / 60)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">الافتراضي: 9 ساعات</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            الساعات المطلوبة للدوام الكامل
          </label>
          <input
            name="expected_hours"
            type="number"
            min={1}
            max={24}
            required
            defaultValue={Math.round((branch.full_time_expected_minutes ?? 840) / 60)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
          />
          <p className="mt-1 text-[11px] text-gray-500">الافتراضي: 14 ساعة</p>
        </div>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
          >
            {pending ? "جاري الحفظ..." : "حفظ القواعد"}
          </button>
          {state?.error ? (
            <p className="text-sm text-red-600 mt-2">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="text-sm text-emerald-600 mt-2">تم الحفظ</p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
