"use client";

import { useRouter } from "next/navigation";
import { FolderKanban, CalendarDays, HardHat, MapPin, AlertCircle } from "lucide-react";
import type { ProjectStatus } from "@/types/db";
import { ProjectStatusSelect } from "./ProjectStatusSelect";

const statusCls: Record<ProjectStatus, string> = {
  planning:    "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300",
  active:      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300",
  completed:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  maintenance: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  survey:      "bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300",
  on_hold:     "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300",
};

const statusLabel: Record<ProjectStatus, string> = {
  planning:    "تصميم",
  active:      "انشاء (اعمال الهيكل)",
  completed:   "تشطيب",
  maintenance: "صيانة",
  survey:      "رفع مساحي",
  on_hold:     "موقوف",
};

type TaskSummary = { is_completed: boolean; due_date: string | null };
type CategorySummary = { tasks: TaskSummary[] };

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
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => {
        const allTasks = p.categories.flatMap((c) => c.tasks);
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter((t) => t.is_completed).length;
        const overdueTasks = allTasks.filter(
          (t) => !t.is_completed && t.due_date && t.due_date < today,
        ).length;
        const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return (
          <div
            key={p.id}
            role="link"
            tabIndex={0}
            onClick={() => router.push(`/portal/timeline/${p.id}`)}
            onKeyDown={(e) => e.key === "Enter" && router.push(`/portal/timeline/${p.id}`)}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all flex flex-col gap-3 cursor-pointer"
          >
            {/* Title + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">{p.name}</h3>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {overdueTasks > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertCircle className="w-3 h-3" /> {overdueTasks} متأخرة
                  </span>
                ) : null}

                {/* Managers get an editable dropdown; stop propagation so the card click doesn't fire */}
                {canManage ? (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <ProjectStatusSelect projectId={p.id} currentStatus={p.status} />
                  </span>
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
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{p.location_notes}</span>
              </div>
            ) : null}

            {p.default_engineer ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                <HardHat className="w-3.5 h-3.5 flex-shrink-0" />
                {p.default_engineer.full_name}
              </div>
            ) : null}

            {p.start_date || p.end_date ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <CalendarDays className="w-3.5 h-3.5" />
                {p.start_date ?? "—"} — {p.end_date ?? "—"}
              </div>
            ) : null}

            {/* Progress stats */}
            <div className="mt-auto">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{totalTasks} مهمة</span>
                <span className="tabular-nums">
                  {completedTasks}/{totalTasks} ({pct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
