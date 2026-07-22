"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateQaTestItemAction } from "@/app/portal/testing/actions";

type Tester = { id: string; full_name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

export function EditQaTestItemButton({
  itemId,
  projectId,
  title,
  description,
  assignedTo,
  testers = [],
}: {
  itemId: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedTo: string | null;
  testers?: Tester[];
}) {
  const [open, setOpen] = useState(false);
  const action = updateQaTestItemAction.bind(null, itemId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      toast.success("تم تعديل عنصر الاختبار");
    }
  }, [state?.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        title="تعديل العنصر"
        aria-label="تعديل عنصر الاختبار"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full mt-2 space-y-2 border border-teal-200 dark:border-teal-800 rounded-lg p-3 bg-teal-50/40 dark:bg-teal-900/10"
    >
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
      <input
        type="text"
        name="title"
        required
        defaultValue={title}
        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
      />
      <textarea
        name="description"
        rows={2}
        defaultValue={description ?? ""}
        placeholder="خطوات / رابط (اختياري)"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
      />
      {testers.length > 0 ? (
        <select
          name="assigned_to"
          defaultValue={assignedTo ?? ""}
          className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
        >
          <option value="">— بدون تعيين —</option>
          {testers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="assigned_to" value={assignedTo ?? ""} />
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-teal-600 text-white rounded-lg disabled:opacity-50"
        >
          حفظ
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1.5 text-gray-400"
          aria-label="إلغاء"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
