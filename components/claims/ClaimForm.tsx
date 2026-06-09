"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createClaimAction } from "@/app/portal/claims/actions";

type ProjectOption = { id: string; name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function ClaimForm({ projects = [] }: { projects?: ProjectOption[] }) {
  const [state, formAction, isPending] = useActionState(createClaimAction, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{state.error}</div>
      ) : null}

      <div>
        <label className={labelCls}>المشروع المرتبط</label>
        <select name="project_id" className={inputCls}>
          <option value="">— بدون مشروع —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>عنوان المطالبة *</label>
        <input type="text" name="title" required placeholder="مثال: مطالبة استرداد مصاريف" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>الوصف</label>
        <textarea name="description" rows={3} placeholder="تفاصيل المطالبة..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>المبلغ (ل.د)</label>
        <input type="number" name="amount" min={0} step={0.01} placeholder="0.00" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>ملف PDF (اختياري)</label>
        <input
          type="file"
          name="file"
          accept=".pdf,application/pdf"
          className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 dark:file:bg-primary-900/20 file:text-primary-700 dark:file:text-primary-300 hover:file:bg-primary-100 dark:hover:file:bg-primary-900/30"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors">
          {isPending ? "جارٍ الحفظ..." : "حفظ المطالبة"}
        </button>
        <Link href="/portal/claims" className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm text-center hover:bg-gray-200 dark:hover:bg-gray-700">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
