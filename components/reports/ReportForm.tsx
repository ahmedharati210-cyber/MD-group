"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createReportAction } from "@/app/portal/reports/actions";

type ProjectOption = { id: string; name: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls = "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function ReportForm({ projects, today }: { projects: ProjectOption[]; today: string }) {
  const [state, formAction, isPending] = useActionState(createReportAction, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{state.error}</div>
      ) : null}

      <div>
        <label className={labelCls}>التاريخ *</label>
        <input type="date" name="report_date" defaultValue={today} required className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>المشروع / الموقع</label>
        <select name="project_id" className={inputCls}>
          <option value="">— بدون مشروع —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className={labelCls}>الأعمال المنجزة</label>
        <textarea name="work_done" rows={4} placeholder="اكتب الأعمال التي تمت اليوم..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>المواد المستخدمة</label>
        <textarea name="materials_used" rows={3} placeholder="قائمة المواد والكميات..." className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>ملاحظات إضافية</label>
        <textarea name="notes" rows={3} placeholder="أي ملاحظات أخرى..." className={inputCls} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors">
          {isPending ? "جارٍ الحفظ..." : "إرسال التقرير"}
        </button>
        <Link href="/portal/reports" className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm text-center hover:bg-gray-200 dark:hover:bg-gray-700">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
