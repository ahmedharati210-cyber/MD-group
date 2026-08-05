"use client";

import { useState } from "react";
import { Bug, CheckCircle2, ChevronDown, Sparkles } from "lucide-react";
import {
  QaScreenshotThumbs,
  type QaScreenshotMeta,
} from "@/components/testing/QaScreenshotGallery";
import { QA_SEVERITY_META } from "@/lib/qa-testing-format";
import { formatDateTime, cn } from "@/lib/utils";
import type { QaTestResult, QaTestSeverity } from "@/types/db";

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

export type QaAttemptHistoryEntry = {
  id: string;
  result: QaTestResult;
  result_note: string | null;
  severity: QaTestSeverity | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  tested_at: string | null;
  reset_at: string;
  tester: { full_name: string } | null;
  resetter: { full_name: string } | null;
  attachments?: QaScreenshotMeta[];
};

export function QaTestAttemptHistory({
  attempts,
}: {
  attempts: QaAttemptHistoryEntry[];
}) {
  if (attempts.length === 0) return null;

  return (
    <ol className="mt-1.5 space-y-1.5 border-r-2 border-gray-200 dark:border-gray-700 pr-2">
      {attempts.map((attempt) => (
        <AttemptEntry key={attempt.id} attempt={attempt} />
      ))}
    </ol>
  );
}

function AttemptEntry({ attempt }: { attempt: QaAttemptHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const meta = resultMeta[attempt.result];
  const Icon = meta.icon;
  const severityMeta = attempt.severity
    ? QA_SEVERITY_META[attempt.severity]
    : null;
  const shots = attempt.attachments ?? [];
  const hasDetails = Boolean(
    attempt.result_note ||
      attempt.steps_to_reproduce ||
      attempt.expected_behavior ||
      shots.length > 0,
  );

  return (
    <li className="text-[11px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-1.5 text-right hover:opacity-80"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 mt-0.5 text-gray-400 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold shrink-0",
            meta.cls,
          )}
        >
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
        {severityMeta ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold shrink-0",
              severityMeta.cls,
            )}
          >
            {severityMeta.label}
          </span>
        ) : null}
        <span className="text-gray-500 dark:text-gray-400 min-w-0 truncate">
          {attempt.tester?.full_name ?? "—"}
          {attempt.tested_at ? ` · ${formatDateTime(attempt.tested_at)}` : ""}
        </span>
      </button>

      {open && hasDetails ? (
        <div className="mt-1 mr-4 space-y-1 text-gray-600 dark:text-gray-300">
          {attempt.result_note ? (
            <p>
              <span className="font-semibold text-gray-500">ماذا حدث: </span>
              {attempt.result_note}
            </p>
          ) : null}
          {attempt.steps_to_reproduce ? (
            <p className="whitespace-pre-wrap">
              <span className="font-semibold text-gray-500">الخطوات: </span>
              {attempt.steps_to_reproduce}
            </p>
          ) : null}
          {attempt.expected_behavior ? (
            <p className="whitespace-pre-wrap">
              <span className="font-semibold text-gray-500">المتوقع: </span>
              {attempt.expected_behavior}
            </p>
          ) : null}
          {shots.length > 0 ? <QaScreenshotThumbs attachments={shots} /> : null}
          {attempt.resetter?.full_name || attempt.reset_at ? (
            <p className="text-gray-400">
              أُعيد فتحه
              {attempt.resetter?.full_name
                ? ` بواسطة ${attempt.resetter.full_name}`
                : ""}
              {attempt.reset_at ? ` · ${formatDateTime(attempt.reset_at)}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
