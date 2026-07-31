"use client";

import { useMemo } from "react";
import { Bug, CheckCircle2, Search, Sparkles } from "lucide-react";
import type { QaListItem, QaListSection } from "@/components/testing/QaSectionsList";
import {
  computeQaProgress,
  QA_RESULT_LABELS,
  QA_SEVERITY_META,
  recentCompletedQaItems,
  recentOpenQaItems,
} from "@/lib/qa-testing-format";
import { formatDateTime, cn } from "@/lib/utils";
import type { QaTestResult, QaTestSeverity } from "@/types/db";

const resultIcon: Record<QaTestResult, typeof CheckCircle2> = {
  pass: CheckCircle2,
  bug: Bug,
  improve: Sparkles,
};

const resultCls: Record<QaTestResult, string> = {
  pass: "text-emerald-600 dark:text-emerald-400",
  bug: "text-red-600 dark:text-red-400",
  improve: "text-amber-600 dark:text-amber-400",
};

type FeedEntry = QaListItem & { sectionName: string; sectionId: string };

export function QaTestingOverviewPanel({
  sections,
  searchQuery,
  onSearchChange,
  onSelectSection,
  onSelectItem,
}: {
  sections: QaListSection[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectSection: (sectionId: string) => void;
  onSelectItem: (itemId: string) => void;
}) {
  const nav = useMemo(() => {
    return sections.map((sec) => {
      const stats = computeQaProgress(sec.items);
      return {
        id: sec.id,
        name: sec.name,
        tested: stats.tested,
        total: stats.total,
        open: stats.open,
      };
    });
  }, [sections]);

  const openItems = useMemo(() => {
    const flat: FeedEntry[] = sections.flatMap((sec) =>
      sec.items.map((item) => ({
        ...item,
        sectionName: sec.name,
        sectionId: sec.id,
      })),
    );
    return recentOpenQaItems(flat, 20);
  }, [sections]);

  const recent = useMemo(() => {
    const flat: FeedEntry[] = sections.flatMap((sec) =>
      sec.items.map((item) => ({
        ...item,
        sectionName: sec.name,
        sectionId: sec.id,
      })),
    );
    return recentCompletedQaItems(flat, 20);
  }, [sections]);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div>
        <label className="sr-only" htmlFor="qa-overview-search">
          بحث في الاختبارات
        </label>
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            id="qa-overview-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث في العناوين..."
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-hidden focus:border-teal-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <h2 className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          الأقسام
        </h2>
        {nav.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">لا أقسام</p>
        ) : (
          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {nav.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(sec.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <span className="flex-1 min-w-0 font-medium text-gray-800 dark:text-gray-100 truncate">
                    {sec.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-400 shrink-0">
                    {sec.tested}/{sec.total}
                    {sec.open > 0 ? ` · ${sec.open} خلل/تحسين` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <h2 className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          خلل وتحسين
        </h2>
        {openItems.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">
            لا خلل أو تحسينات
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {openItems.map((item) => {
              const result = item.result as QaTestResult;
              const Icon = resultIcon[result];
              const severity = item.severity as QaTestSeverity | null | undefined;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    className="w-full px-3 py-2 text-right hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-start gap-1.5">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                          resultCls[result],
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {item.sectionName}
                          {" · "}
                          {QA_RESULT_LABELS[result]}
                          {result === "bug" && severity
                            ? ` · ${QA_SEVERITY_META[severity].label}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <h2 className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          مكتمل مؤخراً
        </h2>
        {recent.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">
            لا عناصر ناجحة بعد
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {recent.map((item) => {
              const result = item.result as QaTestResult;
              const Icon = resultIcon[result];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    className="w-full px-3 py-2 text-right hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-start gap-1.5">
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 mt-0.5 shrink-0",
                          resultCls[result],
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {item.sectionName}
                          {" · "}
                          {QA_RESULT_LABELS[result]}
                          {item.tested_at
                            ? ` · ${formatDateTime(item.tested_at)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
