"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createRequestAction } from "@/app/portal/requests/actions";

type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function RequestForm({ today }: { today: string }) {
  const [state, formAction, isPending] = useActionState(createRequestAction, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{state.error}</div>
      ) : null}

      <div>
        <label className={labelCls}>نوع الطلب *</label>
        <select name="request_type" required className={inputCls}>
          <option value="vacation">إجازة</option>
          <option value="day_off">يوم راحة</option>
          <option value="advance">سلفة مالية</option>
          <option value="equipment">معدات / أدوات</option>
          <option value="other">أخرى</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>وصف الطلب *</label>
        <textarea name="description" rows={4} required placeholder="اشرح طلبك بالتفصيل..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>التاريخ المطلوب (اختياري)</label>
        <input type="date" name="requested_date" defaultValue={today} className={inputCls} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors">
          {isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}
        </button>
        <Link href="/portal/requests" className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm text-center hover:bg-gray-200 dark:hover:bg-gray-700">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
