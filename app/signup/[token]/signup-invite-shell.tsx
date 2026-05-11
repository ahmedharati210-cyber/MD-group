"use client";

import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { EmployeeSignupForm } from "./signup-form";
import type { SignupAppearance } from "./signup-appearance";

const STORAGE_KEY = "dolce-signup-theme";

export function SignupInviteShell({
  token,
  companyNameAr,
  invalid,
  expired,
  wrongCompany,
}: {
  token: string;
  companyNameAr: string;
  invalid: boolean;
  expired: boolean;
  wrongCompany: boolean;
}) {
  const [appearance, setAppearance] = useState<SignupAppearance>("dark");

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark") setAppearance(v);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    const next: SignupAppearance = appearance === "dark" ? "light" : "dark";
    setAppearance(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const isDark = appearance === "dark";

  return (
    <div
      dir="rtl"
      className={cn(
        "min-h-screen flex flex-col relative",
        isDark ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900",
      )}
    >
      <div className="fixed top-4 left-4 z-50 rtl:left-auto rtl:right-4">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "rounded-full p-2.5 border shadow-lg transition-colors",
            isDark
              ? "border-neutral-600 bg-neutral-900 text-amber-200 hover:bg-neutral-800"
              : "border-gray-200 bg-white text-gray-800 hover:bg-gray-100",
          )}
          aria-label={isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
        >
          {isDark ? (
            <Sun className="w-5 h-5" aria-hidden />
          ) : (
            <Moon className="w-5 h-5" aria-hidden />
          )}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative w-full max-w-xs aspect-[2/1] mx-auto">
                <Image
                  key={appearance}
                  src={
                    isDark
                      ? "/logos/dolce-logo.png"
                      : "/logos/dolce-logo-light.png"
                  }
                  alt="Dolce Chocolate"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-neutral-400" : "text-gray-600",
              )}
            >
              علامة Dolce Chocolate — ضمن شركة{" "}
              <span
                className={cn(
                  "font-medium",
                  isDark ? "text-amber-200/90" : "text-amber-800",
                )}
              >
                {companyNameAr}
              </span>
            </p>
          </div>

          <div
            className={cn(
              "rounded-2xl border p-6 sm:p-8 shadow-2xl",
              isDark
                ? "border-amber-600/25 bg-gradient-to-b from-neutral-900/90 to-black shadow-black/80"
                : "border-amber-200/80 bg-gradient-to-b from-white to-amber-50/40 shadow-gray-300/40",
            )}
          >
            <h1
              className={cn(
                "text-xl font-bold text-center mb-2",
                isDark ? "text-neutral-100" : "text-gray-900",
              )}
            >
              طلب انضمام للعمل
            </h1>
            <p
              className={cn(
                "text-sm text-center mb-8",
                isDark ? "text-neutral-400" : "text-gray-600",
              )}
            >
              أدخل بياناتك للمراجعة من قبل الإدارة.
            </p>

            {invalid ? (
              <div
                className={cn(
                  "rounded-xl border p-6 text-center space-y-2",
                  isDark
                    ? "border-red-900/50 bg-red-950/30"
                    : "border-red-200 bg-red-50",
                )}
              >
                <p
                  className={cn(
                    "font-semibold",
                    isDark ? "text-red-300" : "text-red-800",
                  )}
                >
                  {expired
                    ? "انتهت صلاحية هذا الرابط."
                    : wrongCompany
                      ? "هذا الرابط غير صالح."
                      : "هذا الرابط غير صالح أو تم استخدامه مسبقاً."}
                </p>
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-neutral-500" : "text-gray-600",
                  )}
                >
                  اطلب من المسؤول إرسال رابط دعوة جديد إن لزم.
                </p>
              </div>
            ) : (
              <EmployeeSignupForm
                token={token}
                companyNameAr={companyNameAr}
                appearance={appearance}
              />
            )}
          </div>

          <p
            className={cn(
              "mt-8 text-center text-xs",
              isDark ? "text-neutral-600" : "text-gray-500",
            )}
          >
            © {new Date().getFullYear()} — Dolce Chocolate
          </p>
        </div>
      </div>
    </div>
  );
}
