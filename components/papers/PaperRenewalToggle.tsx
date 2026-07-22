"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setPaperRenewalInProgressAction } from "@/app/portal/papers/actions";

export function PaperRenewalToggle({
  documentId,
  initialValue,
  canEdit = true,
  compact = false,
}: {
  documentId: string;
  initialValue: boolean;
  canEdit?: boolean;
  /** Smaller control for table cells */
  compact?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOn(initialValue);
  }, [initialValue]);

  if (!canEdit) {
    if (!on) return null;
    return (
      <span className="inline-flex items-center text-xs font-semibold text-sky-700 dark:text-sky-300">
        قيد التجديد
      </span>
    );
  }

  function handleToggle(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await setPaperRenewalInProgressAction(documentId, next);
      if (res.error) {
        toast.error(res.error);
        setOn(!next);
        return;
      }
      toast.success(next ? "تم وضع الورقة قيد التجديد" : "تم إلغاء قيد التجديد", {
        id: `paper-renewal-${documentId}`,
      });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="قيد التجديد"
      disabled={isPending}
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 rounded-xl border transition-colors select-none disabled:opacity-60 ${
        compact
          ? "px-2.5 py-1.5 text-xs"
          : "w-full justify-between px-3 py-2.5 text-sm"
      } ${
        on
          ? "bg-sky-50 dark:bg-sky-900/25 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200"
          : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
      }`}
    >
      <span className="font-semibold">قيد التجديد</span>
      <span
        className={`relative inline-flex shrink-0 rounded-full transition-colors ${
          compact ? "h-5 w-9" : "h-6 w-11"
        } ${on ? "bg-sky-600" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span
          className={`absolute top-0.5 start-0.5 rounded-full bg-white shadow-sm transition-transform ${
            compact ? "h-4 w-4" : "h-5 w-5"
          } ${
            on
              ? compact
                ? "translate-x-4 rtl:-translate-x-4"
                : "translate-x-5 rtl:-translate-x-5"
              : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
