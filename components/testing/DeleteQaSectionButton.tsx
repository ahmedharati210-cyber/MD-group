"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteQaSectionAction } from "@/app/portal/testing/actions";

export function DeleteQaSectionButton({
  sectionId,
  projectId,
}: {
  sectionId: string;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("حذف هذا القسم وجميع عناصر الاختبار فيه؟")) return;
        startTransition(async () => {
          const res = await deleteQaSectionAction(sectionId, projectId);
          if (res.error) toast.error(res.error);
          else toast.success("تم حذف القسم");
        });
      }}
      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
      title="حذف القسم"
      aria-label="حذف القسم"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
