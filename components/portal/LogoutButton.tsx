"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { disableWebPush } from "@/lib/push/enable-push";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "sidebar" | "icon" | "full";
  className?: string;
};

function useLogout() {
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    // Best-effort unsubscribe — errors are swallowed so logout always proceeds.
    await disableWebPush().catch(() => undefined);
    startTransition(() => {
      logoutAction();
    });
  }

  return { handleLogout, isPending };
}

export function LogoutButton({ variant = "sidebar", className }: Props) {
  const { handleLogout, isPending } = useLogout();

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label="تسجيل الخروج"
        disabled={isPending}
        onClick={handleLogout}
        className={cn(
          "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50",
          className,
        )}
      >
        <LogOut className="w-5 h-5" />
      </button>
    );
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={handleLogout}
        className={cn(
          "w-full flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold",
          "text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50",
          "hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50",
          className,
        )}
      >
        <LogOut className="w-5 h-5" />
        تسجيل الخروج
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleLogout}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="w-5 h-5" />
      تسجيل الخروج
    </button>
  );
}
