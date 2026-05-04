"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateCategoryAction } from "@/app/portal/timeline/actions";

type State = { error?: string; ok?: boolean };
const init: State = {};

export function EditCategoryButton({
  categoryId,
  projectId,
  currentName,
}: {
  categoryId: string;
  projectId: string;
  currentName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const action = updateCategoryAction.bind(null, categoryId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) setIsEditing(false);
  }, [state?.ok]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        aria-label="تعديل الفئة"
      >
        <Pencil className="w-4 h-4" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        name="name"
        defaultValue={currentName}
        required
        className="px-3 py-1.5 text-sm border border-primary-300 dark:border-primary-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 min-w-[120px]"
      />
      <button type="submit" disabled={isPending} className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 disabled:opacity-60">
        <Check className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setIsEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <X className="w-4 h-4" />
      </button>
    </form>
  );
}
