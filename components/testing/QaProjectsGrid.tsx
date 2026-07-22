"use client";

import { useState } from "react";
import Link from "next/link";
import { AppWindow, Check, ChevronDown } from "lucide-react";
import type { QaProjectStatus, QaTestResult } from "@/types/db";
import { QaProjectStatusSelect } from "./QaProjectStatusSelect";

type ItemSummary = {
  id: string;
  title: string;
  result: QaTestResult | null;
  sort_order: number;
};
type SectionSummary = {
  id: string;
  name: string;
  sort_order: number;
  items: ItemSummary[];
};

export type QaProjectCardData = {
  id: string;
  name: string;
  description: string | null;
  status: QaProjectStatus;
  sections: SectionSummary[];
};

const resultDot: Record<QaTestResult, string> = {
  pass: "bg-emerald-500",
  bug: "bg-red-500",
  improve: "bg-amber-500",
};

interface Props {
  projects: QaProjectCardData[];
  canManage: boolean;
  isDoneSection?: boolean;
}

export function QaProjectsGrid({
  projects,
  canManage,
  isDoneSection = false,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => {
        const sortedSections = [...p.sections].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const allItems = sortedSections.flatMap((s) =>
          [...s.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        );
        const total = allItems.length;
        const tested = allItems.filter((i) => i.result != null).length;
        const bugs = allItems.filter((i) => i.result === "bug").length;
        const pct = total > 0 ? Math.round((tested / total) * 100) : 0;
        const isExpanded = expandedId === p.id;

        return (
          <div
            key={p.id}
            className={`relative bg-white dark:bg-gray-900 rounded-2xl border shadow-xs transition-all flex flex-col h-full min-h-0 overflow-hidden focus-within:ring-2 focus-within:ring-inset ${
              isDoneSection
                ? "border-emerald-200 dark:border-emerald-800/60 opacity-80 saturate-75"
                : "border-gray-200 dark:border-gray-800 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700 focus-within:ring-teal-500"
            }`}
          >
            <Link
              href={`/portal/testing/${p.id}`}
              className="absolute inset-0 z-0 rounded-2xl outline-hidden"
              aria-label={`فتح مشروع اختبار ${p.name}`}
            >
              <span className="sr-only">{p.name}</span>
            </Link>

            <div className="relative z-10 flex flex-col flex-1 min-h-0 pointer-events-none">
              <div className="flex flex-col gap-3 p-5 flex-1 min-h-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center shrink-0">
                      <AppWindow className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">
                      {p.name}
                    </h3>
                  </div>
                  <div className="pointer-events-auto shrink-0">
                    {canManage ? (
                      <QaProjectStatusSelect
                        projectId={p.id}
                        status={p.status}
                      />
                    ) : (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          p.status === "done"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                        }`}
                      >
                        {p.status === "done" ? "منتهٍ" : "نشط"}
                      </span>
                    )}
                  </div>
                </div>

                {p.description ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {p.description}
                  </p>
                ) : null}

                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>
                      {tested}/{total} مختبر
                    </span>
                    <span className="font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 dark:bg-teal-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {bugs > 0 ? (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">
                      {bugs} خلل
                    </p>
                  ) : null}
                </div>
              </div>

              {sortedSections.length > 0 ? (
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : p.id);
                    }}
                    className="pointer-events-auto w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <span>{sortedSections.length} أقسام</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isExpanded ? (
                    <ul className="px-5 pb-4 space-y-2 max-h-48 overflow-y-auto">
                      {sortedSections.map((s) => {
                        const sItems = [...s.items].sort(
                          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                        );
                        const sTested = sItems.filter((i) => i.result != null).length;
                        return (
                          <li key={s.id} className="text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                                {s.name}
                              </span>
                              <span className="text-xs text-gray-400 tabular-nums shrink-0">
                                {sTested}/{sItems.length}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {sItems.slice(0, 8).map((item) =>
                                item.result ? (
                                  <span
                                    key={item.id}
                                    className={`w-2 h-2 rounded-full ${resultDot[item.result]}`}
                                    title={item.title}
                                  />
                                ) : (
                                  <span
                                    key={item.id}
                                    className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700"
                                    title={item.title}
                                  />
                                ),
                              )}
                              {sItems.length > 8 ? (
                                <span className="text-[10px] text-gray-400">
                                  +{sItems.length - 8}
                                </span>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 text-xs text-gray-400 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  لا أقسام بعد
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
