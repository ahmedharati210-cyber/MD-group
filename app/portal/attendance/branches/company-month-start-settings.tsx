"use client";

import { useActionState, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ATTENDANCE_MONTH_START_DAY_MAX,
  ATTENDANCE_MONTH_START_DAY_MIN,
  normalizeAttendanceMonthStartDay,
} from "@/lib/attendance/attendance-period";
import {
  updateCompanyAttendanceMonthStartAction,
  type ActionState,
} from "../actions";
import { withPreservedScroll } from "../preserve-scroll";

type Props = {
  companyId: string;
  startDay: number;
};

function endDayLabel(start: number): string {
  return start <= 1 ? "آخر الشهر" : String(start - 1);
}

export function CompanyMonthStartSettings({ companyId, startDay }: Props) {
  const [fromDay, setFromDay] = useState(() =>
    normalizeAttendanceMonthStartDay(startDay),
  );
  const [state, action, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateCompanyAttendanceMonthStartAction, undefined);

  useEffect(() => {
    setFromDay(normalizeAttendanceMonthStartDay(startDay));
  }, [startDay]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (state?.ok) toast.success(state.message ?? "تم الحفظ");
  }, [state]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-8">
      <h3 className="font-bold mb-1">فترة شهر الحضور</h3>
      <p className="text-sm text-gray-500 mb-4">
        مثال: من 28 إلى 27 = من 28 الشهر السابق إلى 27 الشهر المختار.
      </p>
      <form
        action={withPreservedScroll(action)}
        className="grid gap-4 sm:grid-cols-3 items-end"
      >
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="attendance_month_start_day" value={fromDay} />
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            من يوم
          </label>
          <input
            type="number"
            min={ATTENDANCE_MONTH_START_DAY_MIN}
            max={ATTENDANCE_MONTH_START_DAY_MAX}
            required
            value={fromDay}
            onChange={(e) =>
              setFromDay(normalizeAttendanceMonthStartDay(Number(e.target.value)))
            }
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            إلى يوم
          </label>
          <input
            type="text"
            readOnly
            value={endDayLabel(fromDay)}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={pending}
            className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
          >
            {pending ? "جاري الحفظ…" : "حفظ"}
          </button>
        </div>
      </form>
    </div>
  );
}
