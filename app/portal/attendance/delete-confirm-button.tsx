"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  label: string;
  confirmMessage: string;
  action: (formData: FormData) => Promise<ActionResult>;
  hiddenFields: Record<string, string>;
  className?: string;
};

type ActionResult = { error?: string; ok?: boolean };

export function DeleteConfirmButton({
  label,
  confirmMessage,
  action,
  hiddenFields,
  className,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(confirmMessage)) return;
    const fd = new FormData();
    for (const [key, value] of Object.entries(hiddenFields)) {
      fd.set(key, value);
    }
    startTransition(async () => {
      const result = await action(fd);
      if (result?.ok) router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        className ??
        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
      }
    >
      <Trash2 className="w-3 h-3" />
      {pending ? "جاري الحذف..." : label}
    </button>
  );
}
