"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import { markAllWarningsReadAction } from "@/app/portal/warnings/actions";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleMarkAll() {
    startTransition(async () => {
      const res = await markAllWarningsReadAction();
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("تم تعليم الكل كمقروء.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleMarkAll}
      disabled={isPending}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
    >
      <CheckCheck className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
      {isPending ? "جارٍ التحديث..." : "تعليم الكل كمقروء"}
    </button>
  );
}
