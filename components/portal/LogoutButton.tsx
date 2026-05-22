import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "sidebar" | "icon" | "full";
  className?: string;
};

export function LogoutButton({ variant = "sidebar", className }: Props) {
  if (variant === "icon") {
    return (
      <form action={logoutAction} className={className}>
        <button
          type="submit"
          aria-label="تسجيل الخروج"
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </form>
    );
  }

  if (variant === "full") {
    return (
      <form action={logoutAction} className={className}>
        <button
          type="submit"
          className={cn(
            "w-full flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold",
            "text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50",
            "hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors",
          )}
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </form>
    );
  }

  return (
    <form action={logoutAction} className={className}>
      <button
        type="submit"
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        تسجيل الخروج
      </button>
    </form>
  );
}
