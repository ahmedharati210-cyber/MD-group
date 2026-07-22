"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteQaProjectAction } from "@/app/portal/testing/actions";

export function DeleteQaProjectButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        "هل أنت متأكد من حذف هذه المنصة؟ سيتم حذف جميع الأقسام وعناصر الاختبار.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteQaProjectAction(projectId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-semibold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 transition-colors"
    >
      <Trash2 className="w-4 h-4" />
      حذف
    </button>
  );
}
