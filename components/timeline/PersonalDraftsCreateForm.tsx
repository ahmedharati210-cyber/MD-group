"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  createDraftAction,
  type DraftActionState,
} from "@/app/portal/timeline/drafts/actions";

type Category = { id: string; name: string };
type ProjectOption = { id: string; name: string; categories: Category[] };

const init: DraftActionState = {};

const inputCls =
  "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";

export function PersonalDraftsCreateForm({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createDraftAction, init);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [bodyKey, setBodyKey] = useState(0);

  const categories = useMemo(() => {
    const p = projects.find((x) => x.id === projectId);
    return p?.categories ?? [];
  }, [projects, projectId]);

  useEffect(() => {
    if (!state?.ok) return;
    setBodyKey((k) => k + 1);
    toast.success("تم حفظ المسودة.", { id: "draft-saved" });
    router.refresh();
  }, [state, router]);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        لا توجد مشاريع في نطاق الشركة الحالية. اختر شركة أو أضف مشروعاً من «المشاريع».
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/40 p-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
        <Plus className="w-5 h-5 text-primary-600" />
        مسودة جديدة
      </h2>

      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="draft-project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            المشروع
          </label>
          <select
            id="draft-project"
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={inputCls}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="draft-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            المرحلة (اختياري)
          </label>
          <select id="draft-category" name="category_id" key={projectId} className={inputCls} defaultValue="">
            <option value="">— المشروع كاملاً —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="draft-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          النص
        </label>
        <textarea
          key={bodyKey}
          id="draft-body"
          name="body"
          rows={5}
          required
          className={inputCls}
          placeholder="ملاحظات خاصة بك فقط…"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
      >
        {isPending ? "جاري الحفظ…" : "حفظ المسودة"}
      </button>
    </form>
  );
}
