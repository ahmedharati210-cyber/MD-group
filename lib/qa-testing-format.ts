import type { QaTestResult, QaTestSeverity } from "@/types/db";

/** Arabic labels + Tailwind classes for QA severity chips. */
export const QA_SEVERITY_META: Record<
  QaTestSeverity,
  { label: string; cls: string }
> = {
  low: {
    label: "منخفض",
    cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  },
  medium: {
    label: "متوسط",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  high: {
    label: "عالٍ",
    cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  critical: {
    label: "حرج",
    cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

export const QA_RESULT_LABELS: Record<QaTestResult, string> = {
  pass: "تم بنجاح",
  bug: "خلل",
  improve: "يحتاج تحسين",
};

export type QaResultSubmitInput = {
  result: QaTestResult;
  resultNote: string;
  severity?: QaTestSeverity | null;
  stepsToReproduce?: string | null;
  expectedBehavior?: string | null;
};

/**
 * Validates structured bug/improve fields before persisting a QA result.
 * Returns an Arabic error message, or null when valid.
 */
export function validateQaResultSubmit(
  input: QaResultSubmitInput,
): string | null {
  const note = input.resultNote.trim();
  const steps = (input.stepsToReproduce ?? "").trim();

  if (
    (input.result === "bug" || input.result === "improve") &&
    note.length < 1
  ) {
    return "الملاحظة مطلوبة عند تسجيل خلل أو تحسين";
  }

  if (input.result === "bug") {
    if (!input.severity) {
      return "درجة الخطورة مطلوبة عند تسجيل خلل";
    }
    if (steps.length < 1) {
      return "خطوات إعادة الإنتاج مطلوبة عند تسجيل خلل";
    }
  }

  return null;
}
