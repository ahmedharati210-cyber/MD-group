"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTestingAccess } from "@/lib/auth";
import {
  canManageTesting,
  getItqanCompanyId,
} from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { QaTestResult } from "@/types/db";

export type ActionState = { error?: string; ok?: boolean };

function revalidateTesting(projectId?: string) {
  revalidatePath("/portal/testing");
  if (projectId) revalidatePath(`/portal/testing/${projectId}`);
}

async function assertCanManage() {
  const current = await requireTestingAccess();
  if (!canManageTesting(current.profile)) {
    return { error: "ليس لديك صلاحية الإدارة" as const, current: null };
  }
  return { error: null, current };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const projectSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "done"]).default("active"),
});

export async function createQaProjectAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const company_id = await getItqanCompanyId();
  if (!company_id) return { error: "لم يتم العثور على شركة الإتقان" };

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("qa_projects")
    .insert({
      company_id,
      created_by: current.userId,
      ...parsed.data,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(current.userId, "create", "qa_project", row?.id, {
    name: parsed.data.name,
  });

  revalidatePath("/portal/testing");
  redirect("/portal/testing");
}

export async function updateQaProjectAction(
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_projects")
    .update(parsed.data)
    .eq("id", projectId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_project", projectId, {
    name: parsed.data.name,
    status: parsed.data.status,
  });

  revalidateTesting(projectId);
  redirect(`/portal/testing/${projectId}`);
}

export async function updateQaProjectStatusAction(
  projectId: string,
  status: "active" | "done",
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const parsed = z.enum(["active", "done"]).safeParse(status);
  if (!parsed.success) return { error: "حالة غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_projects")
    .update({ status: parsed.data })
    .eq("id", projectId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_project", projectId, {
    status: parsed.data,
  });

  revalidateTesting(projectId);
  return { ok: true };
}

export async function deleteQaProjectAction(
  projectId: string,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_projects")
    .delete()
    .eq("id", projectId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "delete", "qa_project", projectId, {});
  revalidatePath("/portal/testing");
  redirect("/portal/testing");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export async function createQaSectionAction(
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) return { error: "اسم القسم مطلوب" };

  const supabase = await createSupabaseServerClient();
  const { data: maxRow } = await supabase
    .from("qa_sections")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await supabase.from("qa_sections").insert({
    project_id: projectId,
    name,
    sort_order: (maxRow?.sort_order ?? -1) + 1,
  });
  if (error) return { error: error.message };

  void logAudit(current.userId, "create", "qa_section", null, {
    project_id: projectId,
    name,
  });

  revalidateTesting(projectId);
  return { ok: true };
}

export async function updateQaSectionAction(
  sectionId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) return { error: "اسم القسم مطلوب" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_sections")
    .update({ name })
    .eq("id", sectionId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_section", sectionId, { name });
  revalidateTesting(projectId);
  return { ok: true };
}

export async function deleteQaSectionAction(
  sectionId: string,
  projectId: string,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_sections")
    .delete()
    .eq("id", sectionId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "delete", "qa_section", sectionId, {
    project_id: projectId,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Test items
// ---------------------------------------------------------------------------
export async function createQaTestItemAction(
  sectionId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const rawTitle = (formData.get("title") as string | null) ?? "";
  const description = (formData.get("description") as string | null) || null;
  const kindParsed = z.enum(["test", "task"]).safeParse(
    formData.get("item_kind") || "test",
  );
  if (!kindParsed.success) return { error: "نوع العنصر غير صالح" };
  const item_kind = kindParsed.data;

  const titles = rawTitle
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  if (titles.length === 0) return { error: "العنوان مطلوب" };

  const supabase = await createSupabaseServerClient();
  const { data: maxRow } = await supabase
    .from("qa_test_items")
    .select("sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const baseOrder = (maxRow?.sort_order ?? -1) + 1;
  const rows = titles.map((title, idx) => ({
    section_id: sectionId,
    project_id: projectId,
    title,
    description: idx === 0 ? description : null,
    item_kind,
    sort_order: baseOrder + idx,
  }));

  const { error } = await supabase.from("qa_test_items").insert(rows);
  if (error) return { error: error.message };

  void logAudit(current.userId, "create", "qa_test_item", null, {
    titles: titles.join(", "),
    item_kind,
    project_id: projectId,
  });

  revalidateTesting(projectId);
  return { ok: true };
}

export async function updateQaTestItemAction(
  itemId: string,
  projectId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "العنوان مطلوب" };
  const description = (formData.get("description") as string | null) || null;
  const kindParsed = z.enum(["test", "task"]).safeParse(
    formData.get("item_kind") || "test",
  );
  if (!kindParsed.success) return { error: "نوع العنصر غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_test_items")
    .update({
      title,
      description,
      item_kind: kindParsed.data,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_test_item", itemId, {
    title,
    item_kind: kindParsed.data,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

export async function deleteQaTestItemAction(
  itemId: string,
  projectId: string,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_test_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "delete", "qa_test_item", itemId, {
    project_id: projectId,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

export async function submitQaTestResultAction(
  itemId: string,
  projectId: string,
  result: QaTestResult,
  resultNote: string,
): Promise<ActionState> {
  const { userId, profile } = await requireTestingAccess();

  const parsedResult = z.enum(["pass", "bug", "improve"]).safeParse(result);
  if (!parsedResult.success) return { error: "نتيجة غير صالحة" };

  const note = resultNote.trim();
  if (
    (parsedResult.data === "bug" || parsedResult.data === "improve") &&
    note.length < 1
  ) {
    return { error: "الملاحظة مطلوبة عند تسجيل خلل أو تحسين" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("qa_test_items")
    .select("result")
    .eq("id", itemId)
    .maybeSingle<{ result: QaTestResult | null }>();

  if (!existing) return { error: "عنصر الاختبار غير موجود" };
  if (existing.result != null && !canManageTesting(profile)) {
    return { error: "تم تسجيل نتيجة مسبقاً — اطلب من المدير إعادة فتح العنصر" };
  }

  const { error } = await supabase
    .from("qa_test_items")
    .update({
      result: parsedResult.data,
      result_note: note || null,
      tested_by: userId,
      tested_at: new Date().toISOString(),
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(userId, "update", "qa_test_item", itemId, {
    result: parsedResult.data,
    project_id: projectId,
  });

  revalidateTesting(projectId);
  return { ok: true };
}

export async function resetQaTestResultAction(
  itemId: string,
  projectId: string,
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_test_items")
    .update({
      result: null,
      result_note: null,
      tested_by: null,
      tested_at: null,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_test_item", itemId, {
    reset: true,
    project_id: projectId,
  });

  revalidateTesting(projectId);
  return { ok: true };
}

/** Quick flip between اختبار and مهمة. */
export async function convertQaItemKindAction(
  itemId: string,
  projectId: string,
  nextKind: "test" | "task",
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  const parsed = z.enum(["test", "task"]).safeParse(nextKind);
  if (!parsed.success) return { error: "نوع العنصر غير صالح" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("qa_test_items")
    .update({ item_kind: parsed.data })
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "qa_test_item", itemId, {
    item_kind: parsed.data,
    convert: true,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

/** Developer: task done → convert to test for QA. */
export async function markQaTaskReadyForTestAction(
  itemId: string,
  projectId: string,
): Promise<ActionState> {
  const { userId } = await requireTestingAccess();

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("qa_test_items")
    .select("item_kind")
    .eq("id", itemId)
    .maybeSingle<{ item_kind: string }>();

  if (!existing) return { error: "العنصر غير موجود" };
  if (existing.item_kind !== "task") {
    return { error: "هذا الإجراء للمهام فقط" };
  }

  const { error } = await supabase
    .from("qa_test_items")
    .update({
      item_kind: "test",
      result: null,
      result_note: null,
      tested_by: null,
      tested_at: null,
    })
    .eq("id", itemId);
  if (error) return { error: error.message };

  void logAudit(userId, "update", "qa_test_item", itemId, {
    ready_for_test: true,
    item_kind: "test",
    project_id: projectId,
  });
  revalidateTesting(projectId);
  return { ok: true };
}
