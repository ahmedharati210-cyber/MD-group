"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteQaTestItemAction } from "@/app/portal/testing/actions";

export function DeleteQaTestItemButton({
  itemId,
  projectId,
}: {
  itemId: string;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("حذف عنصر الاختبار؟")) return;
        startTransition(async () => {
          const res = await deleteQaTestItemAction(itemId, projectId);
          if (res.error) toast.error(res.error);
          else toast.success("تم الحذف");
        });
      }}
      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
      title="حذف"
      aria-label="حذف عنصر الاختبار"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
