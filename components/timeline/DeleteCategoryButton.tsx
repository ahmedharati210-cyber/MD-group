"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteCategoryAction } from "@/app/portal/timeline/actions";

export function DeleteCategoryButton({ categoryId, projectId }: { categoryId: string; projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("هل أنت متأكد؟ سيتم حذف الفئة وجميع مهامها.")) return;
    startTransition(async () => {
      const res = await deleteCategoryAction(categoryId, projectId);
      if (res.error) toast.error(res.error);
      else toast.success("تم حذف الفئة");
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-60 transition-colors"
      aria-label="حذف الفئة"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
