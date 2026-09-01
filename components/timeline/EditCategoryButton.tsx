"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { updateCategoryAction } from "@/app/portal/timeline/actions";
import type { ActionState } from "@/app/portal/timeline/actions";

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-hidden";

export function EditCategoryButton({
  categoryId,
  projectId,
  currentName,
}: {
  categoryId: string;
  projectId: string;
  currentName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const boundAction = updateCategoryAction.bind(null, categoryId, projectId);
  const [state, formAction, isPending] = useActionState<ActionState | undefined, FormData>(
    boundAction,
    undefined,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("تم تحديث الفئة");
      setIsOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        aria-label="تعديل الفئة"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="تعديل الفئة"
        >
          <div
            ref={dialogRef}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
            dir="rtl"
          >
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-50 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary-500" />
                تعديل الفئة
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form action={formAction} className="p-5 space-y-4">
              {state?.error ? (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {state.error}
                </p>
              ) : null}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  اسم الفئة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={currentName}
                  className={inputCls}
                />
              </div>

              <input type="hidden" name="sort_order" value="0" />

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جارٍ الحفظ...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      حفظ التعديلات
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
