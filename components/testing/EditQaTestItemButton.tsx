"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateQaTestItemAction } from "@/app/portal/testing/actions";
import {
  QaScreenshotGallery,
  type QaScreenshotMeta,
} from "@/components/testing/QaScreenshotGallery";
import type { QaItemKind } from "@/types/db";

type State = { error?: string; ok?: boolean };
const init: State = {};

export function EditQaTestItemButton({
  open,
  onOpenChange,
}: {
  itemId: string;
  projectId: string;
  title: string;
  description: string | null;
  itemKind: QaItemKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (open) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenChange(true)}
      className="p-1.5 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
      title="تعديل العنصر"
      aria-label="تعديل العنصر"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  );
}

export function EditQaTestItemForm({
  itemId,
  projectId,
  title,
  description,
  itemKind,
  itemAttachments = [],
  onClose,
}: {
  itemId: string;
  projectId: string;
  title: string;
  description: string | null;
  itemKind: QaItemKind;
  itemAttachments?: QaScreenshotMeta[];
  onClose: () => void;
}) {
  const action = updateQaTestItemAction.bind(null, itemId, projectId);
  const [state, formAction, isPending] = useActionState(action, init);
  const [kind, setKind] = useState<QaItemKind>(itemKind);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      toast.success("تم التعديل");
    }
  }, [state?.ok, onClose]);

  return (
    <form
      action={formAction}
      className="mt-2 space-y-2 border border-teal-200 dark:border-teal-800 rounded-lg p-3 bg-teal-50/40 dark:bg-teal-900/10"
    >
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
      <label className="sr-only" htmlFor={`edit-kind-${itemId}`}>
        نوع العنصر
      </label>
      <select
        id={`edit-kind-${itemId}`}
        name="item_kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as QaItemKind)}
        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
      >
        <option value="test">اختبار</option>
        <option value="task">مهمة</option>
      </select>
      <label className="sr-only" htmlFor={`edit-title-${itemId}`}>
        العنوان
      </label>
      <input
        id={`edit-title-${itemId}`}
        type="text"
        name="title"
        required
        defaultValue={title}
        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
      />
      <label className="sr-only" htmlFor={`edit-desc-${itemId}`}>
        الوصف
      </label>
      <textarea
        id={`edit-desc-${itemId}`}
        name="description"
        rows={2}
        defaultValue={description ?? ""}
        placeholder="خطوات / رابط (اختياري)"
        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
      />
      {kind === "task" || itemAttachments.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium text-gray-500 mb-1">
            لقطات شاشة للمهمة
          </p>
          <QaScreenshotGallery
            itemId={itemId}
            projectId={projectId}
            scope="item"
            attachments={itemAttachments}
            canEdit
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="text-xs font-semibold px-3 py-1.5 bg-teal-600 text-white rounded-lg disabled:opacity-50"
        >
          حفظ
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400"
          aria-label="إلغاء"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </form>
  );
}
