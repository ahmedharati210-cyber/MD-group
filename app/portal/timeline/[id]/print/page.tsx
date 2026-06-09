import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/timeline/PrintButton";
import { SaveAsPdfButton } from "@/components/timeline/SaveAsPdfButton";
import type { ProjectStatus } from "@/types/db";

const statusLabels: Record<ProjectStatus, string> = {
  planning:    "تصميم",
  active:      "انشاء (اعمال الهيكل)",
  completed:   "تشطيب",
  maintenance: "صيانة",
  survey:      "رفع مساحي",
  on_hold:       "متوقف",
  on_hold_claim: "متوقف ( مطالبة)",
};

function calcRemaining(days: number | null | undefined, setAt: string | null | undefined, today: string): number | null {
  if (days == null || days < 0) return null;
  if (!setAt) return days;
  const elapsed = Math.floor(
    (new Date(today).getTime() - new Date(setAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, days - elapsed);
}

function remainingLabel(days: number | null | undefined, setAt: string | null | undefined, today: string): string {
  const r = calcRemaining(days, setAt, today);
  if (r == null) return "—";
  if (r === 0) return "اليوم الأخير";
  return r === 1 ? "يوم واحد" : `${r} يوم`;
}

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  is_completed: boolean;
  sort_order: number;
  assignee: { full_name: string } | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  tasks: TaskRow[];
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  location_notes: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  default_engineer: { full_name: string } | null;
};

export default async function PrintProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: rawProject }, { data: rawCategories }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, start_date, end_date, status, estimated_days, estimated_days_set_at, location_notes, manager_name, manager_phone, default_engineer:default_engineer_id(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("project_categories")
      .select("id, name, sort_order, estimated_days, estimated_days_set_at, tasks:project_tasks(id, title, description, due_date, estimated_days, estimated_days_set_at, is_completed, sort_order, assignee:assigned_to(full_name))")
      .eq("project_id", id)
      .order("sort_order"),
  ]);

  if (!rawProject) notFound();

  const project = rawProject as unknown as ProjectRow;
  const categories = ((rawCategories ?? []) as unknown as CategoryRow[]).map((cat) => ({
    ...cat,
    tasks: [...cat.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const today = new Date().toISOString().slice(0, 10);
  const allTasks = categories.flatMap((c) => c.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const overdueTasks = allTasks.filter((t) => !t.is_completed && t.due_date && t.due_date < today).length;
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const printDate = new Date().toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8" dir="rtl">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={`/portal/timeline/${id}`}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← العودة للمشروع
        </Link>
        <div className="flex items-center gap-2">
          <SaveAsPdfButton projectId={id} />
          <PrintButton />
        </div>
      </div>

      {/* Printable content */}
      <div>

      {/* Header */}
      <div className="border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description ? (
              <p className="text-sm text-gray-600 mt-1">{project.description}</p>
            ) : null}
          </div>
          <div className="text-left text-sm text-gray-600 shrink-0">
            <div className="font-semibold">{statusLabels[project.status]}</div>
            <div>{printDate}</div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm text-gray-700">
          {project.location_notes ? (
            <div><span className="font-semibold">الموقع: </span>{project.location_notes}</div>
          ) : null}
          {project.default_engineer ? (
            <div><span className="font-semibold">المهندس: </span>{project.default_engineer.full_name}</div>
          ) : null}
          {project.start_date ? (
            <div><span className="font-semibold">البداية: </span>{project.start_date}</div>
          ) : null}
          {project.end_date ? (
            <div><span className="font-semibold">النهاية: </span>{project.end_date}</div>
          ) : null}
          {project.manager_name ? (
            <div><span className="font-semibold">الغفير: </span>{project.manager_name}</div>
          ) : null}
          {project.manager_phone ? (
            <div><span className="font-semibold">الهاتف: </span>{project.manager_phone}</div>
          ) : null}
        </div>
      </div>

      {/* Progress summary */}
      <div className="flex items-center gap-6 mb-6 p-3 bg-gray-50 rounded-xl text-sm flex-wrap">
        <div><span className="font-bold text-lg">{pct}%</span> <span className="text-gray-600">مكتمل</span></div>
        <div><span className="font-semibold">{completedTasks}</span> / {totalTasks} <span className="text-gray-600">مهمة</span></div>
        {project.estimated_days != null ? (
          <div>
            <span className="font-semibold">{remainingLabel(project.estimated_days, project.estimated_days_set_at, today)}</span>{" "}
            <span className="text-gray-600">متبقي للمشروع</span>
          </div>
        ) : null}
        {overdueTasks > 0 ? (
          <div className="text-red-600 font-semibold">{overdueTasks} مهمة متأخرة</div>
        ) : null}
        {/* Progress bar */}
        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Categories and tasks */}
      {categories.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">لا توجد فئات أو مهام.</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catDone = cat.tasks.filter((t) => t.is_completed).length;
            return (
              <div key={cat.id} className="break-inside-avoid">
                {/* Category heading */}
                <div className="flex items-center justify-between bg-gray-100 px-4 py-2 rounded-lg mb-1">
                  <h2 className="font-bold text-gray-900">{cat.name}</h2>
                  <div className="text-sm text-gray-600 flex items-center gap-3">
                    {cat.estimated_days != null ? (
                      <span>متبقي: {remainingLabel(cat.estimated_days, cat.estimated_days_set_at, today)}</span>
                    ) : null}
                    <span>{catDone}/{cat.tasks.length} تم</span>
                  </div>
                </div>

                {cat.tasks.length === 0 ? (
                  <p className="text-sm text-gray-400 px-4 py-2">لا توجد مهام.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-200">
                        <th className="py-1 px-2 w-6" />
                        <th className="py-1 px-2 text-right">المهمة</th>
                        <th className="py-1 px-2 text-right">المسؤول</th>
                        <th className="py-1 px-2 text-right whitespace-nowrap">أيام متبقية</th>
                        <th className="py-1 px-2 text-right whitespace-nowrap">الاستحقاق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.tasks.map((task) => {
                        const isOverdue = !task.is_completed && task.due_date && task.due_date < today;
                        return (
                          <tr key={task.id} className="border-b border-gray-100">
                            <td className="py-2 px-2 w-6 text-center">
                              {/* Checkbox */}
                              <span className={`inline-block w-4 h-4 border-2 rounded-xs align-middle ${task.is_completed ? "bg-gray-900 border-gray-900" : "border-gray-400"}`}>
                                {task.is_completed ? (
                                  <svg viewBox="0 0 12 10" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="1,5 4,8 11,1" />
                                  </svg>
                                ) : null}
                              </span>
                            </td>
                            <td className={`py-2 px-2 flex-1 ${task.is_completed ? "line-through text-gray-400" : ""}`}>
                              {task.title}
                              {task.description ? (
                                <span className="block text-xs text-gray-500">{task.description}</span>
                              ) : null}
                            </td>
                            <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">
                              {task.assignee?.full_name ?? "—"}
                            </td>
                            <td className="py-2 px-2 text-gray-600 text-xs whitespace-nowrap tabular-nums">
                              {remainingLabel(task.estimated_days, task.estimated_days_set_at, today)}
                            </td>
                            <td className={`py-2 px-2 text-xs whitespace-nowrap ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                              {task.due_date ?? "—"}
                              {isOverdue ? " ⚠" : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between print:block">
        <span>MD Group — {project.name}</span>
        <span>{printDate}</span>
      </div>

      </div>{/* end #pdf-content */}
    </div>
  );
}
