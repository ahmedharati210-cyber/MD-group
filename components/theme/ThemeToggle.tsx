"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
      title={isDark ? "وضع نهاري" : "وضع ليلي"}
      className={cn(
        "inline-flex items-center justify-center w-9 h-9 rounded-lg",
        "text-gray-600 dark:text-gray-300",
        "hover:bg-gray-100 dark:hover:bg-gray-800",
        "transition-colors",
        className,
      )}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
