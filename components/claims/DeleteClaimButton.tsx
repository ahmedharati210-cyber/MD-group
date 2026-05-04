"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteClaimAction } from "@/app/portal/claims/actions";

export function DeleteClaimButton({ claimId }: { claimId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذه المطالبة؟")) return;
    startTransition(async () => {
      const res = await deleteClaimAction(claimId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors flex-shrink-0" aria-label="حذف">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
