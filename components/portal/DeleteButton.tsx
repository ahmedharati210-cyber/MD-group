"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  confirmText?: string;
  label?: string;
  className?: string;
  compact?: boolean;
  extra?: Record<string, string>;
};

/**
 * Client wrapper that submits a server action after a native confirm() prompt.
 * Keeps the form progressive (still works without JS by submitting directly).
 */
export function DeleteButton({
  action,
  id,
  confirmText = "هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذه العملية.",
  label = "حذف",
  className,
  compact,
  extra,
}: Props) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {extra
        ? Object.entries(extra).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl font-semibold transition-colors",
          "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
          "hover:bg-red-100 dark:hover:bg-red-900/50",
          compact ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
          className,
        )}
      >
        <Trash2 className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
        {label}
      </button>
    </form>
  );
}
