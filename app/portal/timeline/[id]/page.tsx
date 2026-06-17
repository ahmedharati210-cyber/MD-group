import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, CalendarDays, Phone, HardHat, MapPin, Printer, CircleAlert, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteProjectButton } from "@/components/timeline/DeleteProjectButton";
import { TaskCheckbox } from "@/components/timeline/TaskCheckbox";
import { AddCategoryForm } from "@/components/timeline/AddCategoryForm";
import { AddTaskForm } from "@/components/timeline/AddTaskForm";
import { DeleteCategoryButton } from "@/components/timeline/DeleteCategoryButton";
import { DeleteTaskButton } from "@/components/timeline/DeleteTaskButton";
import { EditTaskButton } from "@/components/timeline/EditTaskButton";
import { EditCategoryButton } from "@/components/timeline/EditCategoryButton";
import { AssignEngineerButton } from "@/components/timeline/AssignEngineerButton";
import { TaskStatusButton } from "@/components/timeline/TaskStatusButton";
import { TimelineNav } from "@/components/timeline/TimelineNav";
import { ProjectEstimatedDaysField } from "@/components/timeline/ProjectEstimatedDaysField";
import { CategoryEstimatedDaysField } from "@/components/timeline/CategoryEstimatedDaysField";
import { TaskEstimatedDaysField } from "@/components/timeline/TaskEstimatedDaysField";
import type { ProjectStatus, TaskWorkStatus } from "@/types/db";

const statusMap: Record<ProjectStatus, { label: string; cls: string }> = {
  planning:    { label: "تصميم",                cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  active:      { label: "انشاء (اعمال الهيكل)", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  completed:   { label: "تشطيب",               cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  maintenance: { label: "صيانة",               cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  survey:      { label: "رفع مساحي",            cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  on_hold:       { label: "متوقف",               cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  on_hold_claim: { label: "متوقف ( مطالبة)",    cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  done:          { label: "تم الانتهاء",          cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  due_date: string | null;
  estimated_days: number | null;
  estimated_days_set_at: string | null;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  task_status: TaskWorkStatus;
  sort_order: number;
  assignee: { full_name: string } | null;
  completer: { full_name: string } | null;
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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const canManage = profile.role !== "employee" && profile.role !== "owner";

  const [{ data: rawProject }, { data: rawCategories }, { data: engineers }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, description, start_date, end_date, status, estimated_days, estimated_days_set_at, location_notes, manager_name, manager_phone, default_engineer:default_engineer_id(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("project_categories")
      .select("id, name, sort_order, estimated_days, estimated_days_set_at, tasks:project_tasks(id, title, description, notes, due_date, estimated_days, estimated_days_set_at, task_status, is_completed, completed_by, completed_at, assigned_to, sort_order, assignee:assigned_to(full_name), completer:completed_by(full_name))")
      .eq("project_id", id)
      .order("sort_order"),
    canManage
      ? supabase.from("profiles").select("id, full_name").eq("role", "employee").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  if (!rawProject) notFound();

  // Log who viewed this project (fire-and-forget — non-fatal)
  void logAudit(profile.id ?? null, "view", "project", id, { project_name: (rawProject as { name?: string }).name });

  const project = rawProject as unknown as ProjectRow;
  const categories = ((rawCategories ?? []) as unknown as CategoryRow[]).map((cat) => ({
    ...cat,
    tasks: [...cat.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Compute overall progress
  const allTasks = categories.flatMap((c) => c.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.is_completed).length;
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const { label: statusLabel, cls: statusCls } = statusMap[project.status];

  function dueDateChip(due_date: string | null, is_completed: boolean) {
    if (!due_date || is_completed) return null;
    const dt = new Date(due_date);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const label = formatDateTime(due_date);
    if (!isToday && dt < now) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <CircleAlert className="w-3 h-3" /> متأخرة · {label}
        </span>
      );
    }
    if (isToday) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <CircleAlert className="w-3 h-3" /> اليوم · {label}
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {label}
      </span>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={
          <div className="flex gap-2">
            <Link
              href={`/portal/timeline/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </Link>
            {canManage ? (
              <>
                <Link
                  href={`/portal/timeline/${id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  تعديل
                </Link>
                <DeleteProjectButton projectId={id} />
              </>
            ) : null}
          </div>
        }
      />

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusCls}`}>{statusLabel}</span>
        {project.default_engineer ? (
          <span className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 font-medium">
            <HardHat className="w-4 h-4" /> {project.default_engineer.full_name}
          </span>
        ) : null}
        {(project.start_date || project.end_date) ? (
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <CalendarDays className="w-4 h-4" /> {project.start_date ?? "—"} — {project.end_date ?? "—"}
          </span>
        ) : null}
      </div>

      {/* Location + doorman — single subtle card */}
      {(project.location_notes || project.manager_name || project.manager_phone) ? (
        <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 mb-5 flex flex-col gap-2">
          {project.location_notes ? (
            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span>{project.location_notes}</span>
            </div>
          ) : null}
          {(project.manager_name || project.manager_phone) ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-500">الغفير:</span>
                {project.manager_name ? (
                  <span className="font-medium text-gray-700 dark:text-gray-300">{project.manager_name}</span>
                ) : null}
                {project.manager_phone ? (
                  <span className="text-gray-400 dark:text-gray-500 tabular-nums text-xs">{project.manager_phone}</span>
                ) : null}
              </div>
              {project.manager_phone ? (
                <a
                  href={`tel:${project.manager_phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
                >
                  <Phone className="w-3 h-3" />
                  اتصل
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Project total estimation + overall progress */}
      {(canManage || project.estimated_days != null || totalTasks > 0) ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mb-5 shadow-xs">
          <ProjectEstimatedDaysField
            projectId={id}
            initialEstimatedDays={project.estimated_days}
            estimatedDaysSetAt={project.estimated_days_set_at}
            canEdit={canManage}
            showDivider={totalTasks > 0}
          />
          {totalTasks > 0 ? (
            <>
              <div className="flex justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <span>إجمالي الإنجاز</span>
                <span className="tabular-nums">{completedTasks} / {totalTasks} ({overallPct}%)</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all duration-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </>
          ) : canManage ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">لم تُضف مهام بعد — يمكنك تعيين التقدير الإجمالي أعلاه.</p>
          ) : null}
        </div>
      ) : null}

      {/* Add category (manager) */}
      {canManage ? (
        <div className="mb-5">
          <AddCategoryForm projectId={id} />
        </div>
      ) : null}

      {/* Category jump nav (only shown when there are 3+ categories) */}
      {categories.length >= 3 ? (
        <TimelineNav categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      ) : null}

      {/* Categories */}
      {categories.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
          {canManage ? "أضف فئة أولى مثل «كهرباء» أو «مياه»." : "لم تُضف فئات بعد."}
        </p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const catTotal = cat.tasks.length;
            const catDone = cat.tasks.filter((t) => t.is_completed).length;
            const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0;

            return (
              <div key={cat.id} id={`cat-${cat.id}`} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate">{cat.name}</h3>
                    {canManage ? (
                      <EditCategoryButton
                        categoryId={cat.id}
                        projectId={id}
                        currentName={cat.name}
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CategoryEstimatedDaysField
                      categoryId={cat.id}
                      projectId={id}
                      initialEstimatedDays={cat.estimated_days}
                      estimatedDaysSetAt={cat.estimated_days_set_at}
                      canEdit={canManage}
                    />
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catDone === catTotal && catTotal > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {catDone}/{catTotal} تم
                    </span>
                    {canManage ? <DeleteCategoryButton categoryId={cat.id} projectId={id} /> : null}
                  </div>
                </div>

                {/* Category progress bar */}
                {catTotal > 0 ? (
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full bg-green-500 dark:bg-green-400 transition-all duration-500"
                      style={{ width: `${catPct}%` }}
                    />
                  </div>
                ) : null}

                {/* Tasks */}
                <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {cat.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                        task.is_completed
                          ? "bg-green-50/50 dark:bg-green-900/5"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      }`}
                    >
                      <div className="pt-0.5">
                        <TaskCheckbox
                          taskId={task.id}
                          projectId={id}
                          isCompleted={task.is_completed}
                          title={task.title}
                          canUncheck={canManage}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.is_completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-200"}`}>
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{task.description}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <TaskStatusButton
                            taskId={task.id}
                            projectId={id}
                            initialStatus={task.task_status ?? null}
                            isCompleted={task.is_completed}
                            canEdit
                          />
                          {canManage && !task.is_completed ? (
                            <AssignEngineerButton
                              taskId={task.id}
                              projectId={id}
                              taskTitle={task.title}
                              currentAssigneeId={task.assigned_to}
                              currentAssigneeName={task.assignee?.full_name ?? null}
                              engineers={(engineers as { id: string; full_name: string }[] | null) ?? []}
                            />
                          ) : task.assignee ? (
                            <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                              <HardHat className="w-3 h-3" /> {task.assignee.full_name}
                            </span>
                          ) : null}
                          {dueDateChip(task.due_date, task.is_completed)}
                          {!canManage && !task.is_completed ? (
                            <TaskEstimatedDaysField
                              taskId={task.id}
                              projectId={id}
                              initialEstimatedDays={task.estimated_days}
                              estimatedDaysSetAt={task.estimated_days_set_at}
                              canEdit={false}
                            />
                          ) : null}
                          {task.is_completed && task.completer ? (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              ✓ {task.completer.full_name}
                              {task.completed_at ? ` — ${formatDateTime(task.completed_at)}` : ""}
                            </span>
                          ) : null}
                          {task.notes ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">{task.notes}</span>
                          ) : null}
                        </div>
                      </div>
                      {canManage ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!task.is_completed ? (
                            <TaskEstimatedDaysField
                              taskId={task.id}
                              projectId={id}
                              initialEstimatedDays={task.estimated_days}
                              estimatedDaysSetAt={task.estimated_days_set_at}
                              canEdit
                            />
                          ) : null}
                          <EditTaskButton
                            taskId={task.id}
                            projectId={id}
                            initialTitle={task.title}
                            initialDescription={task.description}
                            initialAssignedTo={task.assigned_to}
                            initialDueDate={task.due_date}
                            engineers={(engineers as { id: string; full_name: string }[] | null) ?? []}
                          />
                          <DeleteTaskButton taskId={task.id} projectId={id} />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Add task (manager) */}
                {canManage ? (
                  <div className="px-4 pb-4">
                    <AddTaskForm
                      categoryId={cat.id}
                      projectId={id}
                      engineers={(engineers as { id: string; full_name: string }[] | null) ?? []}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
