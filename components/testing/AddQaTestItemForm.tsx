"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Minus, FlaskConical, ListTodo } from "lucide-react";
import { createQaTestItemAction } from "@/app/portal/testing/actions";
import { QaScreenshotGallery } from "@/components/testing/QaScreenshotGallery";

type State = { error?: string; ok?: boolean; itemIds?: string[] };
const init: State = {};

const inputCls =
  "px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-hidden text-sm";

export function AddQaTestItemForm({
  sectionId,
  projectId,
  onCancel,
}: {
  sectionId: string;
  projectId: string;
  onCancel: () => void;
}) {
  const action = createQaTestItemAction.bind(null, sectionId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const formRef = useRef<HTMLFormElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstTitleRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[]>([""]);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const lastKindRef = useRef<"test" | "task">("test");

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Defer focus until after scroll/layout.
    const id = window.setTimeout(() => firstTitleRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!state?.ok) return;
    const ids = state.itemIds ?? [];
    if (lastKindRef.current === "task" && ids.length === 1) {
      setCreatedTaskId(ids[0]!);
      setRows([""]);
      formRef.current?.reset();
      return;
    }
    setRows([""]);
    formRef.current?.reset();
    onCancel();
  }, [state?.ok, state?.itemIds, onCancel]);

  if (createdTaskId) {
    return (
      <div
        ref={rootRef}
        className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 mt-2 space-y-2"
      >
        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
          تم إنشاء المهمة — أضف لقطات شاشة إن أردت
        </p>
        <QaScreenshotGallery
          itemId={createdTaskId}
          projectId={projectId}
          scope="item"
          attachments={[]}
          canEdit
        />
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:underline"
        >
          تم
        </button>
      </div>
    );
  }

  const hasContent = rows.some((r) => r.trim().length > 0);
  const filledCount = rows.filter((r) => r.trim()).length;

  return (
    <div ref={rootRef}>
    <form
      ref={formRef}
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
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

      <div className="space-y-1.5">
        {rows.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              ref={i === 0 ? firstTitleRef : undefined}
              type="text"
              value={val}
              onChange={(e) =>
                setRows((r) =>
                  r.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              placeholder={i === 0 ? "العنوان..." : `سطر ${i + 1}...`}
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

      <textarea
        name="description"
        rows={2}
        placeholder="خطوات أو رابط (اختياري — يُحفظ مع العنصر الأول)"
        className={`w-full ${inputCls}`}
      />

      <div className="flex flex-wrap gap-2 items-center">
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
          name="item_kind"
          value="test"
          disabled={isPending || !hasContent}
          onClick={() => {
            lastKindRef.current = "test";
          }}
          className="inline-flex items-center gap-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          {isPending
            ? "جارٍ الحفظ..."
            : `إضافة اختبار${filledCount > 1 ? ` (${filledCount})` : ""}`}
        </button>
        <button
          type="submit"
          name="item_kind"
          value="task"
          disabled={isPending || !hasContent}
          onClick={() => {
            lastKindRef.current = "task";
          }}
          className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <ListTodo className="w-3.5 h-3.5" />
          {isPending
            ? "جارٍ الحفظ..."
            : `إضافة مهمة${filledCount > 1 ? ` (${filledCount})` : ""}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </form>
    </div>
  );
}
