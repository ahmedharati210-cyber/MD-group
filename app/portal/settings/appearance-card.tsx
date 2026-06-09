"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  const options: { value: "light" | "dark"; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "نهاري", icon: Sun },
    { value: "dark", label: "ليلي", icon: Moon },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-1">
        المظهر
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        اختر الوضع المفضّل للواجهة.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-sm">
        {options.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all",
                active
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
