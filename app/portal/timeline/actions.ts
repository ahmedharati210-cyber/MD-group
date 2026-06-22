"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { dispatchProjectNotification } from "@/lib/push/dispatch-project-notification";

export type ActionState = { error?: string; ok?: boolean };

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: "تخطيط",
  active: "نشط",
  completed: "مكتمل",
  maintenance: "صيانة",
  survey: "مسح",
  on_hold: "متوقف",
  on_hold_claim: "متوقف (مطالبة)",
  done: "منتهي",
};

/** Empty form field → null; otherwise non-negative integer days. */
function parseEstimatedDaysFromForm(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.floor(n);
}

const estimatedDaysSchema = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return null;
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  },
  z.number().int().min(0).nullable().optional(),
);

function revalidateTimeline(projectId?: string) {
  revalidatePath("/portal/timeline");
  if (projectId) revalidatePath(`/portal/timeline/${projectId}`);
  revalidateTag("projects", "default");
  revalidateTag("dashboard", "default");
}

async function projectNameById(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? null;
}

async function categoryNameById(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  categoryId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("project_categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? null;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const projectSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  description: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z
    .enum([
      "planning",
      "active",
      "completed",
      "maintenance",
      "survey",
      "on_hold",
      "on_hold_claim",
      "done",
    ])
    .default("planning"),
  location_notes: z.string().optional().nullable(),
  manager_name: z.string().optional().nullable(),
  manager_phone: z.string().optional().nullable(),
  default_engineer_id: z.string().uuid().optional().nullable(),
});

export async function createProjectAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireRole(["md_admin", "company_manager"]);
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    status: formData.get("status") || "planning",
    location_notes: formData.get("location_notes") || null,
    manager_name: formData.get("manager_name") || null,
    manager_phone: formData.get("manager_phone") || null,
    default_engineer_id: formData.get("default_engineer_id") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const company_id = await getShellCompanyIdForProfile(profile);
  if (!company_id) return { error: "لم يتم العثور على الشركة" };

  const supabase = await createSupabaseServerClient();
  const { data: newProject, error } = await supabase
    .from("projects")
    .insert({ company_id, created_by: userId, ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "project", newProject?.id, { name: parsed.data.name });

  revalidatePath("/portal/timeline");
  redirect("/portal/timeline");
}

/** Lightweight action — update only the status field of a project. */
export async function updateProjectStatusAction(
  projectId: string,
  status: string,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = z
    .enum([
      "planning",
      "active",
      "completed",
      "maintenance",
      "survey",
      "on_hold",
      "on_hold_claim",
      "done",
    ])
    .safeParse(status);
  if (!parsed.success) return { error: "حالة غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: projectRow } = await supabase
    .from("projects")
    .select("company_id, name")
    .eq("id", projectId)
    .maybeSingle<{ company_id: string; name: string }>();

  const { error } = await supabase
    .from("projects")
    .update({ status: parsed.data })
    .eq("id", projectId);
  if (error) return { error: error.message };

  const project_name = projectRow?.name ?? (await projectNameById(supabase, projectId));
  void logAudit(userId, "update", "project", projectId, {
    status: parsed.data,
    ...(project_name ? { project_name } : {}),
  });

  if (projectRow?.company_id && project_name) {
    const statusLabel = PROJECT_STATUS_LABELS[parsed.data] ?? parsed.data;
    void dispatchProjectNotification({
      companyId: projectRow.company_id,
      senderId: userId,
      message: `تم تغيير حالة مشروع «${project_name}» إلى ${statusLabel}.`,
    });
  }

  revalidateTimeline(projectId);
  return { ok: true };
}

/** Lightweight action — update only the project-level estimated days (manual total). */
export async function updateProjectEstimatedDaysAction(
  projectId: string,
  estimatedDays: number | null,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = estimatedDaysSchema.safeParse(estimatedDays);
  if (!parsed.success) return { error: "عدد الأيام غير صالح" };

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({
      estimated_days: parsed.data ?? null,
      estimated_days_set_at: parsed.data != null ? today : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project", projectId, {
    estimated_days: parsed.data ?? null,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function updateProjectAction(
  id: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    start_date: formData.get("start_date") || null,
    end_date: formData.get("end_date") || null,
    status: formData.get("status") || "planning",
    location_notes: formData.get("location_notes") || null,
    manager_name: formData.get("manager_name") || null,
    manager_phone: formData.get("manager_phone") || null,
    default_engineer_id: formData.get("default_engineer_id") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "update", "project", id, {
    name: parsed.data.name,
    status: parsed.data.status,
  });

  revalidateTimeline(id);
  redirect(`/portal/timeline/${id}`);
}

export async function deleteProjectAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const project_name = await projectNameById(supabase, id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "project", id, {
    ...(project_name ? { project_name } : {}),
  });

  redirect("/portal/timeline");
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const categoryCreateSchema = z.object({
  name: z.string().min(1, "اسم الفئة مطلوب"),
  sort_order: z.coerce.number().default(0),
  estimated_days: estimatedDaysSchema,
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1, "اسم الفئة مطلوب"),
  sort_order: z.coerce.number().default(0),
});

export async function createCategoryAction(
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = categoryCreateSchema.safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") || 0,
    estimated_days: formData.get("estimated_days"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const setAt = new Date().toISOString().slice(0, 10);
  const { data: newCat, error } = await supabase
    .from("project_categories")
    .insert({
      project_id: projectId,
      ...parsed.data,
      estimated_days_set_at: parsed.data.estimated_days != null ? setAt : null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "create", "project_category", newCat?.id, {
    name: parsed.data.name,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function updateCategoryAction(
  categoryId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = categoryUpdateSchema.safeParse({
    name: formData.get("name"),
    sort_order: formData.get("sort_order") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_categories").update(parsed.data).eq("id", categoryId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project_category", categoryId, {
    name: parsed.data.name,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

/** Lightweight action — update only category-level estimated days. */
export async function updateCategoryEstimatedDaysAction(
  categoryId: string,
  projectId: string,
  estimatedDays: number | null,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = estimatedDaysSchema.safeParse(estimatedDays);
  if (!parsed.success) return { error: "عدد الأيام غير صالح" };

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_categories")
    .update({
      estimated_days: parsed.data ?? null,
      estimated_days_set_at: parsed.data != null ? today : null,
    })
    .eq("id", categoryId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  const category_name = await categoryNameById(supabase, categoryId);
  void logAudit(userId, "update", "project_category", categoryId, {
    estimated_days: parsed.data ?? null,
    ...(project_name ? { project_name } : {}),
    ...(category_name ? { category_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function deleteCategoryAction(categoryId: string, projectId: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_categories").delete().eq("id", categoryId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "delete", "project_category", categoryId, {
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const taskUpdateSchema = z.object({
  title: z.string().min(1, "عنوان المهمة مطلوب"),
  description: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "تاريخ غير صالح")
    .optional()
    .nullable(),
  sort_order: z.coerce.number().default(0),
});

export async function createTaskAction(
  categoryId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);

  const rawTitle = (formData.get("title") as string | null) ?? "";
  const assigned_to = (formData.get("assigned_to") as string | null) || null;
  const due_date = (formData.get("due_date") as string | null) || null;
  const estimated_days = parseEstimatedDaysFromForm(formData.get("estimated_days"));

  // Support bulk creation: titles separated by newline
  const titles = rawTitle
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  if (titles.length === 0) return { error: "عنوان المهمة مطلوب" };

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const rows = titles.map((title, idx) => ({
    category_id: categoryId,
    project_id: projectId,
    title,
    assigned_to: assigned_to || null,
    due_date: due_date || null,
    estimated_days,
    estimated_days_set_at: estimated_days != null ? today : null,
    sort_order: idx,
  }));

  const { error } = await supabase.from("project_tasks").insert(rows);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  const category_name = await categoryNameById(supabase, categoryId);
  void logAudit(userId, "create", "project_task", null, {
    titles: titles.join(", "),
    ...(project_name ? { project_name } : {}),
    ...(category_name ? { category_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function updateTaskAction(
  taskId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = taskUpdateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    assigned_to: formData.get("assigned_to") || null,
    due_date: formData.get("due_date") || null,
    sort_order: formData.get("sort_order") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_tasks").update(parsed.data).eq("id", taskId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project_task", taskId, {
    title: parsed.data.title,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

/** Lightweight action — update only task-level estimated days. */
export async function updateTaskEstimatedDaysAction(
  taskId: string,
  projectId: string,
  estimatedDays: number | null,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = estimatedDaysSchema.safeParse(estimatedDays);
  if (!parsed.success) return { error: "عدد الأيام غير صالح" };

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({
      estimated_days: parsed.data ?? null,
      estimated_days_set_at: parsed.data != null ? today : null,
    })
    .eq("id", taskId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project_task", taskId, {
    estimated_days: parsed.data ?? null,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function deleteTaskAction(taskId: string, projectId: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);
  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "delete", "project_task", taskId, {
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function toggleTaskAction(taskId: string, projectId: string, currentlyCompleted: boolean): Promise<ActionState> {
  const { userId, profile } = await requireUser();

  // Employees may only mark tasks as complete, not uncheck them.
  if (currentlyCompleted && profile.role === "employee") {
    return { error: "ليس لديك صلاحية إلغاء الإتمام" };
  }
  const supabase = await createSupabaseServerClient();

  const now = new Date().toISOString();
  const { error } = await supabase.from("project_tasks").update({
    is_completed: !currentlyCompleted,
    completed_by: !currentlyCompleted ? userId : null,
    completed_at: !currentlyCompleted ? now : null,
    ...(!currentlyCompleted ? { task_status: null } : {}),
  }).eq("id", taskId);

  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project_task", taskId, {
    is_completed: !currentlyCompleted,
    ...(project_name ? { project_name } : {}),
  });

  revalidateTimeline(projectId);
  return { ok: true };
}

export async function updateTaskNotesAction(taskId: string, projectId: string, notes: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_tasks").update({ notes }).eq("id", taskId);
  if (error) return { error: error.message };
  revalidateTimeline(projectId);
  return { ok: true };
}

export async function updateTaskStatusAction(
  taskId: string,
  projectId: string,
  status: "in_progress" | null,
): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = z.enum(["in_progress"]).nullable().safeParse(status);
  if (!parsed.success) return { error: "حالة المهمة غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({ task_status: parsed.data })
    .eq("id", taskId);

  if (error) return { error: error.message };

  const project_name = await projectNameById(supabase, projectId);
  void logAudit(userId, "update", "project_task", taskId, {
    task_status: parsed.data,
    ...(project_name ? { project_name } : {}),
  });

  if (parsed.data === "in_progress") {
    const [{ data: taskRow }, { data: projectRow }] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("title")
        .eq("id", taskId)
        .maybeSingle<{ title: string }>(),
      supabase
        .from("projects")
        .select("company_id, name")
        .eq("id", projectId)
        .maybeSingle<{ company_id: string; name: string }>(),
    ]);

    const companyId = projectRow?.company_id;
    const taskTitle = taskRow?.title;
    const projName = projectRow?.name ?? project_name;

    if (companyId && taskTitle && projName) {
      void dispatchProjectNotification({
        companyId,
        senderId: userId,
        message: `تم تغيير حالة المهمة «${taskTitle}» في مشروع «${projName}» إلى قيد التنفيذ.`,
      });
    }
  }

  revalidateTimeline(projectId);
  return { ok: true };
}
