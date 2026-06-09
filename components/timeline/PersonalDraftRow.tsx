"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteDraftAction,
  updateDraftAction,
  type DraftActionState,
} from "@/app/portal/timeline/drafts/actions";

const init: DraftActionState = {};

const inputCls =
  "w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 outline-hidden text-sm";

export type PersonalDraftRowProps = {
  id: string;
  body: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  projectName: string;
  categoryLabel: string | null;
  authorLabel: string | null;
  canEdit: boolean;
  canDelete: boolean;
};

export function PersonalDraftRow({
  id,
  body,
  createdAtLabel,
  updatedAtLabel,
  projectName,
  categoryLabel,
  authorLabel,
  canEdit,
  canDelete,
}: PersonalDraftRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [updState, updAction, updPending] = useActionState(updateDraftAction, init);
  const [delState, delAction, delPending] = useActionState(deleteDraftAction, init);

  useEffect(() => {
    if (!updState?.ok) return;
    setEditing(false);
    toast.success("تم تحديث المسودة.", { id: `draft-upd-${id}` });
    router.refresh();
  }, [updState, id, router]);

  useEffect(() => {
    if (!delState?.ok) return;
    toast.success("تم حذف المسودة.", { id: `draft-del-${id}` });
    router.refresh();
  }, [delState, id, router]);

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-50">{projectName}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {categoryLabel ? `المرحلة: ${categoryLabel}` : "نطاق: المشروع كاملاً"}
          </div>
          {authorLabel ? (
            <div className="text-xs text-primary-700 dark:text-primary-300 mt-1">المؤلف: {authorLabel}</div>
          ) : null}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 text-end space-y-0.5">
          <div>أُنشئت: {createdAtLabel}</div>
          <div>آخر تحديث: {updatedAtLabel}</div>
        </div>
      </div>

      {updState?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{updState.error}</p>
      ) : null}
      {delState?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{delState.error}</p>
      ) : null}

      {editing && canEdit ? (
        <form action={updAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <textarea name="body" defaultValue={body} rows={5} className={inputCls} required />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={updPending}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {updPending ? "…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
            >
              إلغاء
            </button>
          </div>
        </form>
      ) : (
        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            <Pencil className="w-3.5 h-3.5" />
            تعديل
          </button>
        ) : null}
        {canDelete ? (
          <form action={delAction}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={delPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {delPending ? "…" : "حذف"}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}
