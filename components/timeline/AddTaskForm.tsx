"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Minus } from "lucide-react";
import { createTaskAction } from "@/app/portal/timeline/actions";

type Engineer = { id: string; full_name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-hidden text-sm";

export function AddTaskForm({
  categoryId,
  projectId,
  engineers = [],
}: {
  categoryId: string;
  projectId: string;
  engineers?: Engineer[];
}) {
  const action = createTaskAction.bind(null, categoryId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const formRef = useRef<HTMLFormElement>(null);
  const [rows, setRows] = useState<string[]>([""]);
  const [dueDate, setDueDate] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setRows([""]);
      setDueDate("");
      setEstimatedDays("");
      formRef.current?.reset();
    }
  }, [state?.ok]);

  function addRow() {
    setRows((r) => [...r, ""]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, val: string) {
    setRows((r) => r.map((v, idx) => (idx === i ? val : v)));
  }

  const hasContent = rows.some((r) => r.trim().length > 0);
  const filledCount = rows.filter((r) => r.trim()).length;

  return (
    <form ref={formRef} action={formAction} className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 mt-2 space-y-2">
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      {/* Hidden: all task titles as newline-separated */}
      <input type="hidden" name="title" value={rows.filter((r) => r.trim()).join("\n")} />
      {/* Hidden: shared due_date / estimated_days for all tasks in this batch */}
      <input type="hidden" name="due_date" value={dueDate} />
      <input type="hidden" name="estimated_days" value={estimatedDays} />

      {engineers.length > 0 ? (
        <select name="assigned_to" className={`w-full ${inputCls}`}>
          <option value="">— تعيين لـ (اختياري) —</option>
          {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      ) : null}

      <div className="space-y-1.5">
        {rows.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={val}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={i === 0 ? "عنوان المهمة..." : `مهمة ${i + 1}...`}
              className={`flex-1 ${inputCls}`}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
                aria-label="حذف الصف"
              >
                <Minus className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 shrink-0">أيام تقديرية:</label>
        <input
          type="number"
          min={0}
          step={1}
          value={estimatedDays}
          onChange={(e) => setEstimatedDays(e.target.value)}
          placeholder="—"
          className={`${inputCls} w-24`}
        />
        {estimatedDays ? (
          <button
            type="button"
            onClick={() => setEstimatedDays("")}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            مسح
          </button>
        ) : null}
      </div>

      {/* Due date shared for all tasks in this batch */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 dark:text-gray-400 shrink-0">تاريخ ووقت الاستحقاق:</label>
        <input
          type="datetime-local"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        {dueDate ? (
          <button
            type="button"
            onClick={() => setDueDate("")}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            مسح
          </button>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-xs hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
          {isPending ? "جارٍ الحفظ..." : `إضافة${filledCount > 1 ? ` (${filledCount})` : " مهمة"}`}
        </button>
      </div>
    </form>
  );
}
