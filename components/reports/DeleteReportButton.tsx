"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteReportAction } from "@/app/portal/reports/actions";

export function DeleteReportButton({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا التقرير؟")) return;
    startTransition(async () => {
      const res = await deleteReportAction(reportId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors" aria-label="حذف التقرير">
      <Trash2 className="w-5 h-5" />
    </button>
  );
}
