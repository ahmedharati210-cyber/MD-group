import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "secondary" | "success" | "warning";
};

const toneStyles: Record<NonNullable<Props["tone"]>, string> = {
  primary: "from-primary-500 to-primary-600",
  secondary: "from-secondary-500 to-secondary-600",
  success: "from-emerald-500 to-emerald-600",
  warning: "from-amber-500 to-amber-600",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md dark:hover:shadow-black/40 transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
            {label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50 mt-2">
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-sm bg-gradient-to-br flex-shrink-0",
            toneStyles[tone],
          )}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
