"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  CalendarDays,
  HardHat,
  MapPin,
  CircleAlert,
  ChevronDown,
  Check,
} from "lucide-react";
import type { ProjectStatus } from "@/types/db";
import { ProjectStatusSelect } from "./ProjectStatusSelect";

const statusCls: Record<ProjectStatus, string> = {
  planning:    "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300",
  active:      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300",
  completed:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  maintenance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  survey:      "bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300",
  on_hold:       "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300",
  on_hold_claim: "bg-rose-100   text-rose-800   dark:bg-rose-900/30  dark:text-rose-300",
};

const statusLabel: Record<ProjectStatus, string> = {
  planning:      "تصميم",
  active:        "انشاء (اعمال الهيكل)",
  completed:     "تشطيب",
  maintenance:   "صيانة",
  survey:        "رفع مساحي",
  on_hold:       "متوقف",
  on_hold_claim: "متوقف ( مطالبة)",
};

type TaskSummary = {
  id: string;
  title: string;
  is_completed: boolean;
  due_date: string | null;
  sort_order: number;
};
type CategorySummary = { id: string; name: string; sort_order: number; tasks: TaskSummary[] };

export type ProjectCardData = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  location_notes: string | null;
  default_engineer: { full_name: string } | null;
  categories: CategorySummary[];
};

interface Props {
  projects: ProjectCardData[];
  canManage: boolean;
}

export function ProjectsGrid({ projects, canManage }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => {
        const sortedCategories = [...p.categories].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const allTasks = sortedCategories.flatMap((c) =>
          [...c.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        );
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter((t) => t.is_completed).length;
        const overdueTasks = allTasks.filter(
          (t) => !t.is_completed && t.due_date && t.due_date < today,
        ).length;
        const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const isExpanded = expandedId === p.id;

        return (
          <div
            key={p.id}
            className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all flex flex-col h-full min-h-0 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-inset"
          >
            <Link
              href={`/portal/timeline/${p.id}`}
              className="absolute inset-0 z-0 rounded-2xl outline-hidden"
              aria-label={`فتح مشروع ${p.name}`}
            >
              <span className="sr-only">{p.name}</span>
            </Link>

            <div className="relative z-10 flex flex-col flex-1 min-h-0 pointer-events-none">
              <div className="flex flex-col gap-3 p-5 flex-1 min-h-0">
                {/* Title + status (status controls are interactive — not under the stretch link) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
                      <FolderKanban className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">{p.name}</h3>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
                    {overdueTasks > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <CircleAlert className="w-3 h-3" /> {overdueTasks} متأخرة
                      </span>
                    ) : null}

                    {canManage ? (
                      <ProjectStatusSelect projectId={p.id} currentStatus={p.status} />
                    ) : (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusCls[p.status] ?? statusCls.on_hold}`}>
                        {statusLabel[p.status] ?? p.status}
                      </span>
                    )}
                  </div>
                </div>

                {p.description ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{p.description}</p>
                ) : null}

                {p.location_notes ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.location_notes}</span>
                  </div>
                ) : null}

                {p.default_engineer ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <HardHat className="w-3.5 h-3.5 shrink-0" />
                    {p.default_engineer.full_name}
                  </div>
                ) : null}

                {p.start_date || p.end_date ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {p.start_date ?? "—"} — {p.end_date ?? "—"}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-800 pointer-events-auto">
              <button
                type="button"
                className="w-full text-start rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-expanded={isExpanded}
                aria-controls={`project-tasks-${p.id}`}
                id={`project-stats-${p.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(isExpanded ? null : p.id);
                }}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="inline-flex items-center gap-1">
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "-rotate-180" : ""}`}
                      aria-hidden
                    />
                    <span>{totalTasks} مهمة</span>
                  </span>
                  <span className="tabular-nums">
                    {completedTasks}/{totalTasks} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden pointer-events-none">
                  <div
                    className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>

              {isExpanded ? (
                <div
                  id={`project-tasks-${p.id}`}
                  role="region"
                  aria-labelledby={`project-stats-${p.id}`}
                  className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 px-2 py-2 text-start"
                >
                  {totalTasks === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">لا مهام بعد.</p>
                  ) : (
                    <ul className="space-y-3">
                      {sortedCategories.map((cat) => {
                        const tasks = [...cat.tasks].sort(
                          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
                        );
                        if (tasks.length === 0) return null;
                        return (
                          <li key={cat.id}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 px-2 mb-1">
                              {cat.name}
                            </p>
                            <ul className="space-y-0.5">
                              {tasks.map((t) => (
                                <li
                                  key={t.id}
                                  className="flex items-start gap-2 rounded-md px-2 py-1 text-sm text-gray-800 dark:text-gray-100"
                                >
                                  <span
                                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                      t.is_completed
                                        ? "border-primary-500 bg-primary-500 text-white"
                                        : "border-gray-300 dark:border-gray-600"
                                    }`}
                                    aria-hidden
                                  >
                                    {t.is_completed ? <Check className="w-3 h-3" strokeWidth={3} /> : null}
                                  </span>
                                  <span className={t.is_completed ? "line-through text-gray-400 dark:text-gray-500" : ""}>
                                    {t.title}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
