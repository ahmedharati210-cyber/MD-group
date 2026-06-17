"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { updateProjectStatusAction } from "@/app/portal/timeline/actions";
import type { ProjectStatus } from "@/types/db";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning",       label: "تصميم" },
  { value: "active",         label: "انشاء (اعمال الهيكل)" },
  { value: "completed",      label: "تشطيب" },
  { value: "maintenance",    label: "صيانة" },
  { value: "survey",         label: "رفع مساحي" },
  { value: "on_hold",        label: "متوقف" },
  { value: "on_hold_claim",  label: "متوقف ( مطالبة)" },
  { value: "done",           label: "تم الانتهاء ✓" },
];

const statusCls: Record<ProjectStatus, string> = {
  planning:      "bg-blue-100   text-blue-700   border-blue-200   dark:bg-blue-900/30   dark:text-blue-300   dark:border-blue-800",
  active:        "bg-green-100  text-green-700  border-green-200  dark:bg-green-900/30  dark:text-green-300  dark:border-green-800",
  completed:     "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  maintenance:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  survey:        "bg-cyan-100   text-cyan-700   border-cyan-200   dark:bg-cyan-900/30   dark:text-cyan-300   dark:border-cyan-800",
  on_hold:       "bg-amber-100  text-amber-700  border-amber-200  dark:bg-amber-900/30  dark:text-amber-300  dark:border-amber-800",
  on_hold_claim: "bg-rose-100   text-rose-800   border-rose-200   dark:bg-rose-900/30   dark:text-rose-300   dark:border-rose-800",
  done:          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
};

interface Props {
  projectId: string;
  currentStatus: ProjectStatus;
}

export function ProjectStatusSelect({ projectId, currentStatus }: Props) {
  const [status, setStatus] = useState<ProjectStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const next = e.target.value as ProjectStatus;
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await updateProjectStatusAction(projectId, next);
      if (res.error) {
        toast.error(res.error);
        setStatus(prev); // revert on error
      }
    });
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer appearance-none outline-hidden transition-opacity disabled:opacity-60 ${statusCls[status]}`}
      style={{ backgroundImage: "none" }}
      aria-label="تغيير الحالة"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
