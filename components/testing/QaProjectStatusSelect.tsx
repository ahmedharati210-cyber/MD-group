"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { updateQaProjectStatusAction } from "@/app/portal/testing/actions";
import type { QaProjectStatus } from "@/types/db";

export function QaProjectStatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: QaProjectStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as QaProjectStatus;
        startTransition(async () => {
          const res = await updateQaProjectStatusAction(projectId, next);
          if (res.error) toast.error(res.error);
          else toast.success("تم تحديث الحالة");
        });
      }}
      onClick={(e) => e.stopPropagation()}
      className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 outline-hidden cursor-pointer disabled:opacity-60 ${
        status === "done"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
      }`}
    >
      <option value="active">نشط</option>
      <option value="done">منتهٍ</option>
    </select>
  );
}
