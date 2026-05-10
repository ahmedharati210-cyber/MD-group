"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, ArrowRight, Loader2, Mail } from "lucide-react";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";
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
          جارٍ الإرسال...
        </>
      ) : (
        "إرسال رابط الاسترداد"
      )}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 px-4 py-10">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex flex-col items-center gap-4 mb-5 group">
            <span className="inline-flex rounded-2xl bg-white shadow-md ring-1 ring-gray-100 p-3 transition-transform group-hover:scale-105">
              <img src="/Logo-MD.png" alt="MD Group" className="h-20 w-auto object-contain" width={160} height={80} />
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">استرداد كلمة المرور</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-black/40 border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
          {state?.ok ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-1">تم الإرسال!</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة خلال دقائق.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline"
              >
                <ArrowRight className="w-4 h-4" />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            <form action={formAction} className="space-y-5">
              {state?.error ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
                </div>
              ) : null}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@md-group.ly"
                    className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition"
                  />
                </div>
              </div>

              <Submit />

              <div className="text-center">
                <Link href="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                  ← العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
