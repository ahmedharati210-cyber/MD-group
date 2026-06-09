"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, CircleAlert, CircleCheckBig } from "lucide-react";
import toast from "react-hot-toast";
import { changePasswordAction, type ActionState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ الحفظ...
        </>
      ) : (
        <>
          <KeyRound className="w-4 h-4" />
          تغيير كلمة المرور
        </>
      )}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(
    changePasswordAction,
    {},
  );

  useEffect(() => {
    if (state?.ok) toast.success("تم تغيير كلمة المرور بنجاح");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl">
          <CircleCheckBig className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 dark:text-green-300">تم تغيير كلمة المرور بنجاح</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            كلمة المرور الجديدة
          </label>
          <input
            type="password"
            name="new_password"
            required
            minLength={6}
            placeholder="٦ أحرف على الأقل"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            تأكيد كلمة المرور
          </label>
          <input
            type="password"
            name="confirm_password"
            required
            minLength={6}
            placeholder="أعد كتابة كلمة المرور"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
          />
        </div>
      </div>
      <Submit />
    </form>
  );
}
