"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTestingAccess } from "@/lib/auth";
import {
  canInteractWithTesting,
  canManageTesting,
  getItqanCompanyId,
} from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { QaTestResult } from "@/types/db";

export type ActionState = { error?: string; ok?: boolean };

const uuidSchema = z.string().uuid("معرف غير صالح");

function parseUuid(value: string): string | null {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}

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

async function assertCanInteract() {
  const current = await requireTestingAccess();
  if (!canInteractWithTesting(current.profile)) {
    return { error: "غير مصرح" as const, current: null };
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

  if (!parseUuid(projectId)) return { error: "معرف غير صالح" };

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

  if (!parseUuid(projectId)) return { error: "معرف غير صالح" };

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

  if (!parseUuid(projectId)) return { error: "معرف غير صالح" };

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

  if (!parseUuid(projectId)) return { error: "معرف غير صالح" };

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

  if (!parseUuid(sectionId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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

  if (!parseUuid(sectionId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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

  if (!parseUuid(sectionId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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

  const { data: section } = await supabase
    .from("qa_sections")
    .select("project_id")
    .eq("id", sectionId)
    .maybeSingle<{ project_id: string }>();

  if (!section) return { error: "القسم غير موجود" };
  if (section.project_id !== projectId) {
    return { error: "القسم لا ينتمي إلى هذه المنصة" };
  }

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

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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
  const { error: interactError, current } = await assertCanInteract();
  if (interactError || !current) return { error: interactError ?? "غير مصرح" };

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

  const parsedResult = z.enum(["pass", "bug", "improve"]).safeParse(result);
  if (!parsedResult.success) return { error: "نتيجة غير صالحة" };

  const note = resultNote.trim();
  if (
    (parsedResult.data === "bug" || parsedResult.data === "improve") &&
    note.length < 1
  ) {
    return { error: "الملاحظة مطلوبة عند تسجيل خلل أو تحسين" };
  }

  const isManager = canManageTesting(current.profile);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("qa_test_items")
    .update({
      result: parsedResult.data,
      result_note: note || null,
      tested_by: current.userId,
      tested_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  // Non-managers may only set a result when none exists yet (atomic race guard).
  if (!isManager) {
    query = query.is("result", null);
  }

  const { data, error } = await query.select("id").maybeSingle<{ id: string }>();
  if (error) return { error: error.message };
  if (!data) {
    return {
      error: isManager
        ? "عنصر الاختبار غير موجود"
        : "تم تسجيل نتيجة مسبقاً — اطلب من المدير إعادة فتح العنصر",
    };
  }

  void logAudit(current.userId, "update", "qa_test_item", itemId, {
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

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

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
  const { error: interactError, current } = await assertCanInteract();
  if (interactError || !current) return { error: interactError ?? "غير مصرح" };

  if (!parseUuid(itemId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("qa_test_items")
    .update({
      item_kind: "test",
      result: null,
      result_note: null,
      tested_by: null,
      tested_at: null,
    })
    .eq("id", itemId)
    .eq("item_kind", "task")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { error: error.message };
  if (!data) return { error: "هذا الإجراء للمهام فقط" };

  void logAudit(current.userId, "update", "qa_test_item", itemId, {
    ready_for_test: true,
    item_kind: "test",
    project_id: projectId,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------
function parseUuidList(ids: string[]): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const out: string[] = [];
  for (const id of ids) {
    const parsed = parseUuid(id);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

export async function reorderQaSectionsAction(
  projectId: string,
  orderedSectionIds: string[],
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  if (!parseUuid(projectId)) return { error: "معرف غير صالح" };
  const ids = parseUuidList(orderedSectionIds);
  if (!ids) return { error: "قائمة الترتيب غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("qa_sections")
    .select("id")
    .eq("project_id", projectId);

  if (fetchError) return { error: fetchError.message };

  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  if (
    existingIds.size !== ids.length ||
    ids.some((id) => !existingIds.has(id))
  ) {
    return { error: "قائمة الأقسام غير متطابقة" };
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("qa_sections")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("project_id", projectId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  void logAudit(current.userId, "update", "qa_section", null, {
    reorder: true,
    project_id: projectId,
    count: ids.length,
  });
  revalidateTesting(projectId);
  return { ok: true };
}

export async function reorderQaTestItemsAction(
  sectionId: string,
  projectId: string,
  orderedItemIds: string[],
): Promise<ActionState> {
  const { error: manageError, current } = await assertCanManage();
  if (manageError || !current) return { error: manageError ?? "غير مصرح" };

  if (!parseUuid(sectionId) || !parseUuid(projectId)) {
    return { error: "معرف غير صالح" };
  }
  const ids = parseUuidList(orderedItemIds);
  if (!ids) return { error: "قائمة الترتيب غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("qa_test_items")
    .select("id")
    .eq("section_id", sectionId)
    .eq("project_id", projectId);

  if (fetchError) return { error: fetchError.message };

  const existingIds = new Set((existing ?? []).map((r) => r.id as string));
  if (
    existingIds.size !== ids.length ||
    ids.some((id) => !existingIds.has(id))
  ) {
    return { error: "قائمة العناصر غير متطابقة" };
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("qa_test_items")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("section_id", sectionId)
        .eq("project_id", projectId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

  void logAudit(current.userId, "update", "qa_test_item", null, {
    reorder: true,
    section_id: sectionId,
    project_id: projectId,
    count: ids.length,
  });
  revalidateTesting(projectId);
  return { ok: true };
}
