"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import toast from "react-hot-toast";
import { markWarningReadAction } from "@/app/portal/warnings/actions";

export function MarkReadButton({ warningId }: { warningId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleMark() {
    startTransition(async () => {
      const res = await markWarningReadAction(warningId);
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <button onClick={handleMark} disabled={isPending} className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-60 transition-colors" aria-label="تم القراءة" title="تم القراءة">
      <CheckCheck className="w-4 h-4" />
    </button>
  );
}
