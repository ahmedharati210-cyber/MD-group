"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Bug, Sparkles, RotateCcw, Rocket } from "lucide-react";
import toast from "react-hot-toast";
import {
  markQaTaskReadyForTestAction,
  resetQaTestResultAction,
  submitQaTestResultAction,
} from "@/app/portal/testing/actions";
import type { QaItemKind, QaTestResult } from "@/types/db";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

const actionBtn =
  "inline-flex items-center justify-center gap-1 rounded-md transition-colors disabled:opacity-50 text-[11px] font-semibold";

export function QaTestResultPanel({
  itemId,
  projectId,
  itemKind,
  result,
  resultNote,
  testedAt,
  testerName,
  canManage,
  canInteract,
  compact = false,
}: {
  itemId: string;
  projectId: string;
  itemKind: QaItemKind;
  result: QaTestResult | null;
  resultNote: string | null;
  testedAt: string | null;
  testerName: string | null;
  canManage: boolean;
  canInteract: boolean;
  compact?: boolean;
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

  function markReady() {
    if (!confirm("تم إنجاز المهمة وتحويلها إلى اختبار للفريق؟")) return;
    startTransition(async () => {
      const res = await markQaTaskReadyForTestAction(itemId, projectId);
      if (res.error) toast.error(res.error);
      else toast.success("أصبحت جاهزة للاختبار");
    });
  }

  if (itemKind === "task") {
    if (!canInteract) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
            compact ? "px-2 py-1" : "px-3 py-1.5",
          )}
        >
          مهمة قيد التطوير
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={isPending}
        onClick={markReady}
        title="تم وجاهز للاختبار"
        aria-label="تم وجاهز للاختبار"
        className={cn(
          "inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50",
          compact ? "px-2 py-1" : "px-3 py-1.5",
        )}
      >
        <Rocket className="w-3.5 h-3.5" />
        {isPending ? "جارٍ..." : compact ? "جاهز للاختبار" : "تم وجاهز للاختبار"}
      </button>
    );
  }

  if (result) {
    const meta = resultMeta[result];
    const Icon = meta.icon;
    return (
      <div
        className={cn(
          "flex flex-col gap-0.5 items-stretch",
          !compact && "mt-2",
        )}
      >
        <div className="flex items-center gap-1 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full",
              compact ? "px-1.5 py-0.5" : "px-2.5 py-1 gap-1.5 text-xs",
              meta.cls,
            )}
            title={
              testerName
                ? `${meta.label} · ${testerName}${testedAt ? ` · ${formatDateTime(testedAt)}` : ""}`
                : meta.label
            }
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          {canManage ? (
            <button
              type="button"
              disabled={isPending}
              onClick={reset}
              title="إعادة الاختبار"
              aria-label="إعادة الاختبار"
              className="p-1 text-gray-400 hover:text-teal-600 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
        {resultNote ? (
          <p
            className={cn(
              "text-gray-600 dark:text-gray-300",
              compact
                ? "text-[11px] leading-snug line-clamp-2"
                : "text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2",
            )}
            title={resultNote}
          >
            {resultNote}
          </p>
        ) : null}
      </div>
    );
  }

  // Owners (view-only): show pending state without action buttons
  if (!canInteract) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-[11px] font-medium text-gray-400",
          compact ? "px-1" : "px-2 py-1",
        )}
      >
        بانتظار الاختبار
      </span>
    );
  }

  const needsNote =
    pendingResult === "bug" ||
    pendingResult === "improve" ||
    note.length > 0;

  return (
    <div className={cn(!compact && "mt-2 space-y-2")}>
      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("pass")}
          title="تم بنجاح"
          aria-label="تم بنجاح"
          className={cn(
            actionBtn,
            compact ? "px-2 py-1" : "px-2.5 py-1.5",
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 hover:bg-emerald-100",
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          تم
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setPendingResult("bug");
            if (note.trim()) submit("bug");
          }}
          title="خلل"
          aria-label="خلل"
          className={cn(
            actionBtn,
            compact ? "px-2 py-1" : "px-2.5 py-1.5",
            "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 hover:bg-red-100",
          )}
        >
          <Bug className="w-3.5 h-3.5 shrink-0" />
          خلل
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setPendingResult("improve");
            if (note.trim()) submit("improve");
          }}
          title="يحتاج تحسين"
          aria-label="يحتاج تحسين"
          className={cn(
            actionBtn,
            compact ? "px-2 py-1" : "px-2.5 py-1.5",
            "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 hover:bg-amber-100",
          )}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          تحسين
        </button>
      </div>

      {(needsNote || pendingResult) && (
        <div className="mt-1.5 space-y-1.5 min-w-[12rem]">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              pendingResult === "pass" || !pendingResult
                ? "ملاحظة اختيارية..."
                : "صف الخلل أو التحسين..."
            }
            className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 outline-hidden focus:border-teal-500"
          />
          {pendingResult && pendingResult !== "pass" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending || !note.trim()}
                onClick={() => submit(pendingResult)}
                className="px-2 py-1 bg-teal-600 text-white text-[11px] font-semibold rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                حفظ
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setPendingResult(null);
                  setNote("");
                }}
                className="px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
