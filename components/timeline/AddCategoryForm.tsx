"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { createCategoryAction } from "@/app/portal/timeline/actions";

type State = { error?: string; ok?: boolean };
const init: State = {};

export function AddCategoryForm({ projectId }: { projectId: string }) {
  const action = createCategoryAction.bind(null, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap gap-2 items-center">
      {state?.error ? (
        <p className="w-full text-xs text-red-600 dark:text-red-400 px-1">{state.error}</p>
      ) : null}
      <input
        type="text"
        name="name"
        required
        placeholder="اسم الفئة الجديدة (مثال: كهرباء، مياه، شبكات...)"
        className="flex-1 min-w-[200px] px-4 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:border-solid focus:ring-4 focus:ring-primary-500/10 outline-none text-sm"
      />
      <input
        type="number"
        name="estimated_days"
        min={0}
        step={1}
        placeholder="أيام"
        title="أيام تقديرية للفئة"
        className="w-20 px-3 py-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:border-solid focus:ring-4 focus:ring-primary-500/10 outline-none text-sm tabular-nums"
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        <Plus className="w-4 h-4" />
        {isPending ? "..." : "إضافة"}
      </button>
    </form>
  );
}
