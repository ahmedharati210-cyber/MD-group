"use client";

import { useActionState } from "react";
import { CircleCheck, CircleX } from "lucide-react";
import { respondToRequestAction } from "@/app/portal/requests/actions";

type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

export function RespondForm({ requestId }: { requestId: string }) {
  const boundAction = respondToRequestAction.bind(null, requestId);
  const [state, formAction, isPending] = useActionState(boundAction, init);

  if (state?.ok) {
    return (
      <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-300">
        تم تسجيل الرد بنجاح.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">رد المدير</p>
      {state?.error ? (
        <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{state.error}</div>
      ) : null}
      <form action={formAction} className="space-y-3">
        <textarea name="manager_response" rows={3} placeholder="ملاحظة (اختيارية)..." className={inputCls} />
        <div className="flex gap-3">
          <button
            type="submit"
            name="status"
            value="approved"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            <CircleCheck className="w-4 h-4" /> موافقة
          </button>
          <button
            type="submit"
            name="status"
            value="rejected"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            <CircleX className="w-4 h-4" /> رفض
          </button>
        </div>
      </form>
    </div>
  );
}
