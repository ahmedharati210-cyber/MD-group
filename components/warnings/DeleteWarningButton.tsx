"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteWarningAction } from "@/app/portal/warnings/actions";

export function DeleteWarningButton({ warningId }: { warningId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذا الإنذار؟")) return;
    startTransition(async () => {
      const res = await deleteWarningAction(warningId);
      if (res.error) toast.error(res.error);
      else toast.success("تم حذف الإنذار");
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors" aria-label="حذف">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
