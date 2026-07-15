"use client";

import { useTransition, useRef, useState, useEffect } from "react";
import { HardHat, ChevronDown, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateTaskAction } from "@/app/portal/timeline/actions";

type Engineer = { id: string; full_name: string };

export function AssignEngineerButton({
  taskId,
  projectId,
  taskTitle,
  currentAssigneeId,
  currentAssigneeName,
  engineers,
}: {
  taskId: string;
  projectId: string;
  taskTitle: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  engineers: Engineer[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function assign(engineerId: string | null) {
    setOpen(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("title", taskTitle);
      fd.set("assigned_to", engineerId ?? "");
      const res = await updateTaskAction(taskId, projectId, undefined, fd);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border transition-colors ${
          currentAssigneeName
            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            : "border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
        } disabled:opacity-50`}
        aria-label="تعيين مهندس"
      >
        <HardHat className="w-3 h-3 shrink-0" />
        <span className="max-w-[120px] truncate">
          {isPending ? "..." : currentAssigneeName ?? "تعيين"}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open ? (
        <div className="absolute z-50 top-full mt-1 right-0 w-52 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400">
            تعيين مهندس
          </div>
          <div className="max-h-52 overflow-y-auto">
            {currentAssigneeId ? (
              <button
                type="button"
                onClick={() => assign(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-right"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                إزالة التعيين
              </button>
            ) : null}
            {engineers.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => assign(e.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  e.id === currentAssigneeId
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <HardHat className="w-3.5 h-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                {e.full_name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
