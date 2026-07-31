"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Bug,
  Sparkles,
  RotateCcw,
  Rocket,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getQaTestAttemptsAction,
  markQaTaskReadyForTestAction,
  resetQaTestResultAction,
  submitQaTestResultAction,
} from "@/app/portal/testing/actions";
import {
  QaTestAttemptHistory,
  type QaAttemptHistoryEntry,
} from "@/components/testing/QaTestAttemptHistory";
import { QA_SEVERITY_META } from "@/lib/qa-testing-format";
import type { QaItemKind, QaTestResult, QaTestSeverity } from "@/types/db";
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

const SEVERITIES: QaTestSeverity[] = ["low", "medium", "high", "critical"];

const actionBtn =
  "inline-flex items-center justify-center gap-1 rounded-md transition-colors disabled:opacity-50 text-[11px] font-semibold";

export function QaTestResultPanel({
  itemId,
  projectId,
  itemKind,
  result,
  resultNote,
  severity,
  stepsToReproduce,
  expectedBehavior,
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
  severity: QaTestSeverity | null;
  stepsToReproduce: string | null;
  expectedBehavior: string | null;
  testedAt: string | null;
  testerName: string | null;
  canManage: boolean;
  canInteract: boolean;
  compact?: boolean;
}) {
  const [pendingResult, setPendingResult] = useState<QaTestResult | null>(null);
  const [note, setNote] = useState("");
  const [selectedSeverity, setSelectedSeverity] =
    useState<QaTestSeverity | null>(null);
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [attempts, setAttempts] = useState<QaAttemptHistoryEntry[] | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function clearForm() {
    setPendingResult(null);
    setNote("");
    setSelectedSeverity(null);
    setSteps("");
    setExpected("");
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && attempts == null && !historyLoading) {
      setHistoryLoading(true);
      void getQaTestAttemptsAction(itemId).then((res) => {
        setHistoryLoading(false);
        if (res.error) {
          toast.error(res.error);
          setAttempts([]);
          return;
        }
        setAttempts((res.attempts ?? []) as QaAttemptHistoryEntry[]);
      });
    }
  }

  const historyToggle = (
    <button
      type="button"
      onClick={toggleHistory}
      aria-expanded={showHistory}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400"
    >
      <History className="w-3 h-3" />
      {historyLoading
        ? "السجل..."
        : attempts != null
          ? `السجل (${attempts.length})`
          : "السجل"}
    </button>
  );

  const historyBody =
    showHistory &&
    (historyLoading ? (
      <p className="text-[11px] text-gray-400">جارٍ التحميل...</p>
    ) : attempts != null && attempts.length > 0 ? (
      <QaTestAttemptHistory attempts={attempts} />
    ) : attempts != null ? (
      <p className="text-[11px] text-gray-400">لا سجل سابق</p>
    ) : null);

  function submit(selected: QaTestResult) {
    if (selected === "bug" || selected === "improve") {
      if (!note.trim()) {
        setPendingResult(selected);
        toast.error("أضف ملاحظة قبل الحفظ");
        return;
      }
    }
    if (selected === "bug") {
      if (!selectedSeverity) {
        setPendingResult(selected);
        toast.error("اختر درجة الخطورة");
        return;
      }
      if (!steps.trim()) {
        setPendingResult(selected);
        toast.error("أضف خطوات إعادة الإنتاج");
        return;
      }
    }

    startTransition(async () => {
      const res = await submitQaTestResultAction(
        itemId,
        projectId,
        selected,
        note,
        selectedSeverity,
        steps,
        expected,
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success("تم تسجيل النتيجة");
        clearForm();
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
        <div className="space-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
              compact ? "px-2 py-1" : "px-3 py-1.5",
            )}
          >
            مهمة قيد التطوير
          </span>
          {historyToggle}
          {historyBody}
        </div>
      );
    }
    return (
      <div className="space-y-1">
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
        {historyToggle}
        {historyBody}
      </div>
    );
  }

  if (result) {
    const meta = resultMeta[result];
    const Icon = meta.icon;
    const severityMeta = severity ? QA_SEVERITY_META[severity] : null;
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
          {severityMeta ? (
            <span
              className={cn(
                "inline-flex items-center text-[11px] font-semibold rounded-full",
                compact ? "px-1.5 py-0.5" : "px-2 py-0.5",
                severityMeta.cls,
              )}
            >
              {severityMeta.label}
            </span>
          ) : null}
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
            <span className="font-semibold text-gray-500">ماذا حدث: </span>
            {resultNote}
          </p>
        ) : null}
        {stepsToReproduce ? (
          <p
            className={cn(
              "text-gray-600 dark:text-gray-300 whitespace-pre-wrap",
              compact
                ? "text-[11px] leading-snug line-clamp-2"
                : "text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2",
            )}
            title={stepsToReproduce}
          >
            <span className="font-semibold text-gray-500">الخطوات: </span>
            {stepsToReproduce}
          </p>
        ) : null}
        {expectedBehavior ? (
          <p
            className={cn(
              "text-gray-600 dark:text-gray-300 whitespace-pre-wrap",
              compact
                ? "text-[11px] leading-snug line-clamp-2"
                : "text-sm bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2",
            )}
            title={expectedBehavior}
          >
            <span className="font-semibold text-gray-500">المتوقع: </span>
            {expectedBehavior}
          </p>
        ) : null}
        {historyToggle}
        {historyBody}
      </div>
    );
  }

  // Owners (view-only): show pending state without action buttons
  if (!canInteract) {
    return (
      <div className="space-y-1">
        <span
          className={cn(
            "inline-flex items-center text-[11px] font-medium text-gray-400",
            compact ? "px-1" : "px-2 py-1",
          )}
        >
          بانتظار الاختبار
        </span>
        {historyToggle}
        {historyBody}
      </div>
    );
  }

  const needsNote =
    pendingResult === "bug" ||
    pendingResult === "improve" ||
    note.length > 0 ||
    steps.length > 0 ||
    expected.length > 0 ||
    selectedSeverity != null;

  const showStructured = pendingResult === "bug" || pendingResult === "improve";

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
            if (note.trim() && selectedSeverity && steps.trim()) submit("bug");
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
        <div className="mt-1.5 space-y-1.5 min-w-[14rem] max-w-md">
          {showStructured ? (
            <div
              className="flex flex-wrap gap-1"
              role="group"
              aria-label="درجة الخطورة"
            >
              {SEVERITIES.map((s) => {
                const meta = QA_SEVERITY_META[s];
                const selected = selectedSeverity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={isPending}
                    onClick={() => setSelectedSeverity(s)}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors",
                      selected
                        ? meta.cls
                        : "border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                      selected && "border-transparent",
                    )}
                  >
                    {meta.label}
                  </button>
                );
              })}
              {pendingResult === "bug" ? (
                <span className="text-[10px] text-red-500 self-center">
                  * مطلوبة
                </span>
              ) : null}
            </div>
          ) : null}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              pendingResult === "pass" || !pendingResult
                ? "ملاحظة اختيارية..."
                : "ماذا حدث؟ *"
            }
            className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 outline-hidden focus:border-teal-500"
          />

          {showStructured ? (
            <>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={2}
                placeholder={
                  pendingResult === "bug"
                    ? "خطوات إعادة الإنتاج *"
                    : "خطوات إعادة الإنتاج (اختياري)"
                }
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 outline-hidden focus:border-teal-500"
              />
              <textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                placeholder="السلوك المتوقع (اختياري)"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 outline-hidden focus:border-teal-500"
              />
            </>
          ) : null}

          {pendingResult && pendingResult !== "pass" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  isPending ||
                  !note.trim() ||
                  (pendingResult === "bug" &&
                    (!selectedSeverity || !steps.trim()))
                }
                onClick={() => submit(pendingResult)}
                className="px-2 py-1 bg-teal-600 text-white text-[11px] font-semibold rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                حفظ
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={clearForm}
                className="px-2 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          ) : null}
        </div>
      )}

      {historyToggle}
      {historyBody}
    </div>
  );
}
