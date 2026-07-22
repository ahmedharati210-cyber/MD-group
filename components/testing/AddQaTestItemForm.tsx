"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { createQaTestItemAction } from "@/app/portal/testing/actions";

type Tester = { id: string; full_name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls =
  "px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-hidden text-sm";

export function AddQaTestItemForm({
  sectionId,
  projectId,
  testers = [],
}: {
  sectionId: string;
  projectId: string;
  testers?: Tester[];
}) {
  const action = createQaTestItemAction.bind(null, sectionId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<string[]>([""]);

  useEffect(() => {
    if (state?.ok) {
      setRows([""]);
      formRef.current?.reset();
    }
  }, [state?.ok]);

  const hasContent = rows.some((r) => r.trim().length > 0);
  const filledCount = rows.filter((r) => r.trim()).length;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 mt-2 space-y-2"
    >
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <input
        type="hidden"
        name="title"
        value={rows.filter((r) => r.trim()).join("\n")}
      />

      {testers.length > 0 ? (
        <select name="assigned_to" className={`w-full ${inputCls}`}>
          <option value="">— تعيين لمختبر (اختياري) —</option>
          {testers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      ) : null}

      <textarea
        name="description"
        rows={2}
        placeholder="خطوات الاختبار أو الرابط (اختياري — يُحفظ مع العنصر الأول)"
        className={`w-full ${inputCls}`}
      />

      <div className="space-y-1.5">
        {rows.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={val}
              onChange={(e) =>
                setRows((r) =>
                  r.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              placeholder={
                i === 0 ? "ماذا يُختبر؟ مثال: تسجيل الدخول بالإيميل" : `عنصر ${i + 1}...`
              }
              className={`flex-1 ${inputCls}`}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                aria-label="حذف الصف"
              >
                <Minus className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, ""])}
          className="inline-flex items-center gap-1 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-xs hover:border-teal-400 hover:text-teal-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          سطر آخر
        </button>
        <button
          type="submit"
          disabled={isPending || !hasContent}
          className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {isPending
            ? "جارٍ الحفظ..."
            : `إضافة${filledCount > 1 ? ` (${filledCount})` : " عنصر"}`}
        </button>
      </div>
    </form>
  );
}
