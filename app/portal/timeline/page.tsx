import Link from "next/link";
import { Plus, FolderKanban, CalendarDays, HardHat, MapPin, AlertCircle } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import type { ProjectStatus } from "@/types/db";

export const metadata = { title: " المشاريع" };

const statusMap: Record<ProjectStatus, { label: string; cls: string }> = {
  planning: { label: "تخطيط", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  active: { label: "نشط", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "مكتمل", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  on_hold: { label: "موقوف", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

type TaskSummary = { is_completed: boolean; due_date: string | null };
type CategorySummary = { tasks: TaskSummary[] };

type ProjectRow = {
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

export default async function TimelinePage() {
  const { profile } = await requireFeature("timeline");
  const supabase = await createSupabaseServerClient();
  const canManage = profile.role !== "employee";

  const { data: rawProjects } = await supabase
    .from("projects")
    .select(`
      id, name, description, start_date, end_date, status, location_notes,
      default_engineer:default_engineer_id(full_name),
      categories:project_categories(
        tasks:project_tasks(is_completed, due_date)
      )
    `)
    .order("created_at", { ascending: false });

  const projects = (rawProjects ?? []) as unknown as ProjectRow[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title="المشاريع"
        description="متابعة المشاريع الهندسية ومهام كل موقع."
        action={
          canManage ? (
            <Link
              href="/portal/timeline/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              مشروع جديد
            </Link>
          ) : null
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="لا توجد مشاريع"
          description={canManage ? "أضف أول مشروع هندسي." : "لم تُضف مشاريع بعد."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const allTasks = p.categories.flatMap((c) => c.tasks);
            const totalTasks = allTasks.length;
            const completedTasks = allTasks.filter((t) => t.is_completed).length;
            const overdueTasks = allTasks.filter((t) => !t.is_completed && t.due_date && t.due_date < today).length;
            const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const { label, cls } = statusMap[p.status];

            return (
              <Link
                key={p.id}
                href={`/portal/timeline/${p.id}`}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all flex flex-col gap-3"
              >
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
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
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

                {(p.start_date || p.end_date) ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {p.start_date ?? "—"} — {p.end_date ?? "—"}
                  </div>
                ) : null}

                <div className="mt-auto">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>{totalTasks} مهمة</span>
                    <span className="tabular-nums">{completedTasks}/{totalTasks} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
