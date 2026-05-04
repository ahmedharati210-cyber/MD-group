"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { sendWarningAction } from "@/app/portal/warnings/actions";

type Engineer = { id: string; full_name: string };
type Company = { id: string; name_ar: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls =
  "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

type Props = {
  engineers: Engineer[];
  /** Only super admins may send a broadcast (null target). */
  canBroadcast: boolean;
  /** Company list for super admin's broadcast company picker. */
  companies?: Company[];
};

export function SendWarningForm({ engineers, canBroadcast, companies = [] }: Props) {
  const [state, formAction, isPending] = useActionState(sendWarningAction, init);
  const [targetValue, setTargetValue] = useState(engineers[0]?.id ?? "");

  const isBroadcast = targetValue === "";

  if (state?.ok) {
    return (
      <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-300">
        تم إرسال الإنذار بنجاح.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          الموجه إلى
        </label>
        <select
          name="target_profile_id"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          className={inputCls}
        >
          {/* Broadcast option: super admin only */}
          {canBroadcast ? (
            <option value="">الجميع (بث عام)</option>
          ) : null}
          {engineers.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Company picker: only shown for super admin broadcast */}
      {canBroadcast && isBroadcast ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            الشركة المستهدفة *
          </label>
          <select name="warning_company_id" required className={inputCls}>
            <option value="">اختر الشركة</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            سيصل الإنذار لجميع موظفي هذه الشركة.
          </p>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          نص الإنذار *
        </label>
        <textarea
          name="message"
          rows={3}
          required
          placeholder="اكتب رسالة الإنذار..."
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-60 transition-colors"
      >
        <Send className="w-4 h-4" />
        {isPending ? "جارٍ الإرسال..." : "إرسال الإنذار"}
      </button>
    </form>
  );
}
