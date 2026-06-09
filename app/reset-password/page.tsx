"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2, Lock } from "lucide-react";
import { resetPasswordAction, type ResetPasswordState } from "./actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold shadow-lg shadow-primary-600/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          جارٍ الحفظ...
        </>
      ) : (
        "تعيين كلمة المرور الجديدة"
      )}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-10">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">كلمة مرور جديدة</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">أدخل كلمة المرور الجديدة لحسابك.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-black/40 border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
          <form action={formAction} className="space-y-5">
            {state?.error ? (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                <CircleAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
              </div>
            ) : null}

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="8 أحرف على الأقل"
                  className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition"
                />
              </div>
            </div>

            <Submit />
          </form>
        </div>
      </div>
    </div>
  );
}
