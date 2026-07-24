"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createQaProjectAction,
  updateQaProjectAction,
} from "@/app/portal/testing/actions";
import type { QaProject } from "@/types/db";

type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls =
  "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-hidden";
const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

export function QaProjectForm({ project }: { project?: QaProject }) {
  const action = project
    ? updateQaProjectAction.bind(null, project.id)
    : createQaProjectAction;
  const [state, formAction, isPending] = useActionState(action, init);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="qa-project-name" className={labelCls}>
          اسم المنصة *
        </label>
        <input
          id="qa-project-name"
          type="text"
          name="name"
          required
          defaultValue={project?.name ?? ""}
          placeholder="مثال: منصة الحجوزات — الإصدار 2"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="qa-project-description" className={labelCls}>
          وصف / ملاحظات
        </label>
        <textarea
          id="qa-project-description"
          name="description"
          rows={3}
          defaultValue={project?.description ?? ""}
          placeholder="رابط المنصة، بيئة الاختبار، تعليمات عامة..."
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="qa-project-status" className={labelCls}>
          الحالة
        </label>
        <select
          id="qa-project-status"
          name="status"
          defaultValue={project?.status ?? "active"}
          className={inputCls}
        >
          <option value="active">نشط</option>
          <option value="done">منتهٍ</option>
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm hover:bg-teal-700 disabled:opacity-60"
        >
          {isPending ? "جارٍ الحفظ..." : project ? "حفظ التعديلات" : "إنشاء المنصة"}
        </button>
        <Link
          href={project ? `/portal/testing/${project.id}` : "/portal/testing"}
          className="px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          إلغاء
        </Link>
      </div>
    </form>
  );
}
