"use client";

import { useTransition, useRef, useState, useEffect } from "react";
import { CircleDot, ChevronDown, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { updateTaskStatusAction } from "@/app/portal/timeline/actions";
import type { TaskWorkStatus } from "@/types/db";

const STATUS_OPTIONS: { value: TaskWorkStatus; label: string }[] = [
  { value: null, label: "— بدون حالة —" },
  { value: "in_progress", label: "قيد العمل" },
];

export function TaskStatusButton({
  taskId,
  projectId,
  initialStatus,
  isCompleted = false,
  canEdit = true,
}: {
  taskId: string;
  projectId: string;
  initialStatus: TaskWorkStatus;
  isCompleted?: boolean;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<TaskWorkStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isInProgress = status === "in_progress";

  function setTaskStatus(next: TaskWorkStatus) {
    setOpen(false);
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await updateTaskStatusAction(taskId, projectId, next);
      if (res.error) {
        toast.error(res.error);
        setStatus(prev);
      }
    });
  }

  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle2 className="w-3 h-3" />
        تم الانتهاء
      </span>
    );
  }

  if (!canEdit) {
    if (!isInProgress) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        <CircleDot className="w-3 h-3" />
        قيد العمل
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
          isInProgress
            ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
            : "border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
        } disabled:opacity-50`}
        aria-label="حالة المهمة"
      >
        <CircleDot className="w-3 h-3 shrink-0" />
        <span className="max-w-[120px] truncate">
          {isPending ? "..." : isInProgress ? "قيد العمل" : "الحالة"}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open ? (
        <div className="absolute z-50 top-full mt-1 right-0 w-44 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400">
            الحالة
          </div>
          <div className="max-h-52 overflow-y-auto">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value ?? "none"}
                type="button"
                onClick={() => setTaskStatus(option.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  option.value === status
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <CircleDot className="w-3.5 h-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
