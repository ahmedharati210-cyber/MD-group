"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateQaSectionAction } from "@/app/portal/testing/actions";

type State = { error?: string; ok?: boolean };
const init: State = {};

export function EditQaSectionButton({
  sectionId,
  projectId,
  name,
}: {
  sectionId: string;
  projectId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const action = updateQaSectionAction.bind(null, sectionId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      toast.success("تم التعديل");
    }
  }, [state?.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        title="تعديل القسم"
        aria-label="تعديل القسم"
      >
        <Pencil className="w-4 h-4" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5 flex-wrap">
      {state?.error ? (
        <span className="text-xs text-red-500 w-full">{state.error}</span>
      ) : null}
      <input
        type="text"
        name="name"
        required
        defaultValue={name}
        className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-40"
      />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs font-semibold text-teal-600 disabled:opacity-50"
      >
        حفظ
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="p-1 text-gray-400"
        aria-label="إلغاء"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
