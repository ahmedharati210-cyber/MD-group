"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { convertQaItemKindAction } from "@/app/portal/testing/actions";
import type { QaItemKind } from "@/types/db";

export function QaItemKindBadge({
  itemId,
  projectId,
  itemKind,
  canManage,
}: {
  itemId: string;
  projectId: string;
  itemKind: QaItemKind;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const isTask = itemKind === "task";

  function flip() {
    const next: QaItemKind = isTask ? "test" : "task";
    const label = next === "task" ? "مهمة" : "اختبار";
    if (!confirm(`تحويل هذا العنصر إلى «${label}»؟`)) return;
    startTransition(async () => {
      const res = await convertQaItemKindAction(itemId, projectId, next);
      if (res.error) toast.error(res.error);
      else toast.success(`تم التحويل إلى ${label}`);
    });
  }

  const cls = isTask
    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
    : "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";

  if (!canManage) {
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
        {isTask ? "مهمة" : "اختبار"}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={flip}
      title={
        isTask ? "اضغط للتحويل إلى اختبار" : "اضغط للتحويل إلى مهمة"
      }
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-opacity hover:opacity-80 disabled:opacity-50 shrink-0 ${cls}`}
    >
      {isTask ? "مهمة" : "اختبار"}
    </button>
  );
}
