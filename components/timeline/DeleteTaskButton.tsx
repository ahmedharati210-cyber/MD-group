"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { deleteTaskAction } from "@/app/portal/timeline/actions";

export function DeleteTaskButton({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    startTransition(async () => {
      const res = await deleteTaskAction(taskId, projectId);
      if (res.error) toast.error(res.error);
      else toast.success("تم حذف المهمة");
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-60 transition-colors opacity-0 group-hover:opacity-100"
      aria-label="حذف المهمة"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );
}
