"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import toast from "react-hot-toast";
import { toggleTaskAction } from "@/app/portal/timeline/actions";

export function TaskCheckbox({
  taskId,
  projectId,
  isCompleted,
  title,
  canUncheck = true,
  canCheck = true,
}: {
  taskId: string;
  projectId: string;
  isCompleted: boolean;
  title: string;
  canUncheck?: boolean;
  canCheck?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const isLocked =
    (isCompleted && !canUncheck) || (!isCompleted && !canCheck);

  function handleToggle() {
    if (isLocked) return;
    startTransition(async () => {
      const res = await toggleTaskAction(taskId, projectId, isCompleted);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending || isLocked}
      aria-label={isCompleted ? "مكتمل" : "وضع علامة مكتمل"}
      title={
        isLocked
          ? isCompleted
            ? "فقط المدير يمكنه إلغاء الإتمام"
            : "عرض فقط — لا يمكن تعديل المهمة"
          : undefined
      }
      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
        isPending
          ? "opacity-50 cursor-not-allowed"
          : isLocked
          ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600 cursor-default"
          : isCompleted
          ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600 hover:bg-green-600 dark:hover:bg-green-700"
          : "border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 bg-white dark:bg-gray-900"
      }`}
    >
      {isCompleted ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> : null}
    </button>
  );
}
