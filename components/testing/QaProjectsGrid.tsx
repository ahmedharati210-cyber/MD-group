"use client";

import { useState } from "react";
import Link from "next/link";
import { AppWindow, Check, ChevronDown } from "lucide-react";
import type { QaItemKind, QaProjectStatus, QaTestResult } from "@/types/db";
import { QaProjectStatusSelect } from "./QaProjectStatusSelect";

type ItemSummary = {
  id: string;
  title: string;
  result: QaTestResult | null;
  sort_order: number;
  item_kind?: QaItemKind;
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {projects.map((p) => {
        const sortedSections = [...p.sections].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const allItems = sortedSections.flatMap((s) =>
          [...s.items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        );
        const testItems = allItems.filter(
          (i) => (i.item_kind ?? "test") !== "task",
        );
        const taskCount = allItems.length - testItems.length;
        const total = testItems.length;
        const tested = testItems.filter((i) => i.result != null).length;
        const bugs = testItems.filter((i) => i.result === "bug").length;
        const pct = total > 0 ? Math.round((tested / total) * 100) : 0;
        const isExpanded = expandedId === p.id;

        return (
          <div
            key={p.id}
            className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-xs transition-[box-shadow,border-color] flex flex-col overflow-hidden ${
              isDoneSection
                ? "border-emerald-200 dark:border-emerald-800/60 opacity-80 saturate-75"
                : isExpanded
                  ? "border-teal-300 dark:border-teal-600 shadow-md"
                  : "border-gray-200 dark:border-gray-800 hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between gap-2 p-5 pb-0">
              <Link
                href={`/portal/testing/${p.id}`}
                className="flex items-center gap-2 min-w-0 flex-1 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <div className="w-9 h-9 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <AppWindow className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">
                  {p.name}
                </h3>
              </Link>
              <div className="shrink-0">
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

            <Link
              href={`/portal/testing/${p.id}`}
              className="block px-5 pt-3 pb-5 outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
            >
              {p.description ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                  {p.description}
                </p>
              ) : null}

              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>
                    {tested}/{total} مختبر
                    {taskCount > 0 ? ` · ${taskCount} مهام` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">{pct}%</span>
                </div>
                <div
                  className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`تقدم الاختبار ${pct}%`}
                >
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
            </Link>

            {sortedSections.length > 0 ? (
              <div className="border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 outline-hidden focus-visible:bg-gray-50 dark:focus-visible:bg-gray-800/50"
                >
                  <span>{sortedSections.length} أقسام</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                {isExpanded ? (
                  <ul className="px-5 pb-4 space-y-2 max-h-72 overflow-y-auto overscroll-contain">
                    {sortedSections.map((s) => {
                      const sItems = [...s.items].sort(
                        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                      );
                      const sTests = sItems.filter(
                        (i) => (i.item_kind ?? "test") !== "task",
                      );
                      const sTested = sTests.filter(
                        (i) => i.result != null,
                      ).length;
                      return (
                        <li key={s.id} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                              {s.name}
                            </span>
                            <span className="text-xs text-gray-400 tabular-nums shrink-0">
                              {sTested}/{sTests.length}
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
        );
      })}
    </div>
  );
}
