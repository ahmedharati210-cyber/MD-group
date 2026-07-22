"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Bug, Sparkles, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import {
  resetQaTestResultAction,
  submitQaTestResultAction,
} from "@/app/portal/testing/actions";
import type { QaTestResult } from "@/types/db";
import { formatDateTime } from "@/lib/utils";

const resultMeta: Record<
  QaTestResult,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  pass: {
    label: "تم بنجاح",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  bug: {
    label: "خلل",
    cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: Bug,
  },
  improve: {
    label: "يحتاج تحسين",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    icon: Sparkles,
  },
};

export function QaTestResultPanel({
  itemId,
  projectId,
  result,
  resultNote,
  testedAt,
  testerName,
  canManage,
}: {
  itemId: string;
  projectId: string;
  result: QaTestResult | null;
  resultNote: string | null;
  testedAt: string | null;
  testerName: string | null;
  canManage: boolean;
}) {
  const [pendingResult, setPendingResult] = useState<QaTestResult | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(selected: QaTestResult) {
    if (selected === "bug" || selected === "improve") {
      if (!note.trim()) {
        setPendingResult(selected);
        toast.error("أضف ملاحظة قبل الحفظ");
        return;
      }
    }
    startTransition(async () => {
      const res = await submitQaTestResultAction(
        itemId,
        projectId,
        selected,
        note,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success("تم تسجيل النتيجة");
        setPendingResult(null);
        setNote("");
      }
    });
  }

  function reset() {
    if (!confirm("إعادة فتح عنصر الاختبار للاختبار من جديد؟")) return;
    startTransition(async () => {
      const res = await resetQaTestResultAction(itemId, projectId);
      if (res.error) toast.error(res.error);
      else toast.success("تم إعادة فتح العنصر");
    });
  }

  if (result) {
    const meta = resultMeta[result];
    const Icon = meta.icon;
    return (
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </span>
          {testerName ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              بواسطة {testerName}
              {testedAt ? ` · ${formatDateTime(testedAt)}` : ""}
            </span>
          ) : null}
          {canManage ? (
            <button
              type="button"
              disabled={isPending}
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة الاختبار
            </button>
          ) : null}
        </div>
        {resultNote ? (
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
            {resultNote}
          </p>
        ) : null}
      </div>
    );
  }

  const needsNote =
    pendingResult === "bug" ||
    pendingResult === "improve" ||
    note.length > 0;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("pass")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          تم بنجاح
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setPendingResult("bug");
            if (note.trim()) submit("bug");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
        >
          <Bug className="w-3.5 h-3.5" />
          خلل
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setPendingResult("improve");
            if (note.trim()) submit("improve");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          يحتاج تحسين
        </button>
      </div>

      {(needsNote || pendingResult) && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              pendingResult === "pass" || !pendingResult
                ? "ملاحظة اختيارية..."
                : "صف الخلل أو التحسين المطلوب..."
            }
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-hidden"
          />
          {pendingResult && pendingResult !== "pass" ? (
            <button
              type="button"
              disabled={isPending || !note.trim()}
              onClick={() => submit(pendingResult)}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              حفظ النتيجة
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
