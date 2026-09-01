"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { deleteMapAction } from "@/app/portal/maps/actions";

export function DeleteMapButton({ mapId }: { mapId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("هل أنت متأكد من حذف هذه الخريطة؟")) return;
    startTransition(async () => {
      const res = await deleteMapAction(mapId);
      if (res.error) toast.error(res.error);
      else toast.success("تم حذف الخريطة");
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending} className="inline-flex min-h-11 min-w-11 items-center justify-center text-red-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors" aria-label="حذف">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
