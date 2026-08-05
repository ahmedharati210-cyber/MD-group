"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTestingAccess } from "@/lib/auth";
import {
  canInteractWithTesting,
  canManageTesting,
} from "@/lib/itqan-testing";
import {
  QA_SCREENSHOT_MAX_COUNT,
  qaScreenshotExt,
  validateQaScreenshotMeta,
  type QaAttachmentScope,
} from "@/lib/qa-screenshots";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const scopeSchema = z.enum(["item", "result"]);

function revalidateProject(projectId: string) {
  revalidatePath("/portal/testing");
  revalidatePath(`/portal/testing/${projectId}`);
}

async function assertItemInProject(itemId: string, projectId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("qa_test_items")
    .select("id, project_id, item_kind")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .maybeSingle<{
      id: string;
      project_id: string;
      item_kind: "test" | "task";
    }>();
  return data;
}

async function liveCount(
  itemId: string,
  scope: QaAttachmentScope,
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("qa_test_attachments")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
    .eq("scope", scope)
    .is("attempt_id", null);
  return count ?? 0;
}

export async function prepareQaScreenshotUploadAction(
  itemId: string,
  projectId: string,
  scope: QaAttachmentScope,
  mimeType: string,
  byteSize: number,
): Promise<{
  error?: string;
  signedUrl?: string;
  storagePath?: string;
  token?: string;
}> {
  const current = await requireTestingAccess();
  const parsedScope = scopeSchema.safeParse(scope);
  if (!parsedScope.success) return { error: "نطاق غير صالح" };
  if (!uuidSchema.safeParse(itemId).success || !uuidSchema.safeParse(projectId).success) {
    return { error: "معرف غير صالح" };
  }

  const metaError = validateQaScreenshotMeta(mimeType, byteSize);
  if (metaError) return { error: metaError };

  if (parsedScope.data === "item") {
    if (!canManageTesting(current.profile)) {
      return { error: "ليس لديك صلاحية إضافة صور للمهمة" };
    }
  } else if (!canInteractWithTesting(current.profile)) {
    return { error: "غير مصرح" };
  }

  const item = await assertItemInProject(itemId, projectId);
  if (!item) return { error: "العنصر غير موجود" };

  if ((await liveCount(itemId, parsedScope.data)) >= QA_SCREENSHOT_MAX_COUNT) {
    return { error: `حد أقصى ${QA_SCREENSHOT_MAX_COUNT} صور` };
  }

  const storagePath = `qa-testing/${projectId}/${itemId}/${crypto.randomUUID()}.${qaScreenshotExt(mimeType)}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return { error: error?.message ?? "فشل إنشاء رابط الرفع" };
  }

  return {
    signedUrl: data.signedUrl,
    storagePath,
    token: data.token,
  };
}

export async function finalizeQaScreenshotUploadAction(
  itemId: string,
  projectId: string,
  scope: QaAttachmentScope,
  storagePath: string,
  mimeType: string,
  byteSize: number,
): Promise<{ error?: string; attachment?: QaAttachmentRow }> {
  const current = await requireTestingAccess();
  const parsedScope = scopeSchema.safeParse(scope);
  if (!parsedScope.success) return { error: "نطاق غير صالح" };
  if (!uuidSchema.safeParse(itemId).success || !uuidSchema.safeParse(projectId).success) {
    return { error: "معرف غير صالح" };
  }

  const metaError = validateQaScreenshotMeta(mimeType, byteSize);
  if (metaError) return { error: metaError };

  if (parsedScope.data === "item") {
    if (!canManageTesting(current.profile)) {
      return { error: "ليس لديك صلاحية إضافة صور للمهمة" };
    }
  } else if (!canInteractWithTesting(current.profile)) {
    return { error: "غير مصرح" };
  }

  const expectedPrefix = `qa-testing/${projectId}/${itemId}/`;
  if (
    typeof storagePath !== "string" ||
    !storagePath.startsWith(expectedPrefix) ||
    storagePath.includes("..") ||
    storagePath.includes("//")
  ) {
    return { error: "مسار غير صالح" };
  }

  const item = await assertItemInProject(itemId, projectId);
  if (!item) return { error: "العنصر غير موجود" };

  if ((await liveCount(itemId, parsedScope.data)) >= QA_SCREENSHOT_MAX_COUNT) {
    return { error: `حد أقصى ${QA_SCREENSHOT_MAX_COUNT} صور` };
  }

  const supabase = await createSupabaseServerClient();
  const { data: maxRow } = await supabase
    .from("qa_test_attachments")
    .select("sort_order")
    .eq("item_id", itemId)
    .eq("scope", parsedScope.data)
    .is("attempt_id", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { data, error } = await supabase
    .from("qa_test_attachments")
    .insert({
      item_id: itemId,
      project_id: projectId,
      scope: parsedScope.data,
      storage_path: storagePath,
      mime_type: mimeType,
      byte_size: byteSize,
      sort_order: (maxRow?.sort_order ?? -1) + 1,
      uploaded_by: current.userId,
    })
    .select(
      "id, item_id, project_id, scope, attempt_id, storage_path, mime_type, byte_size, sort_order",
    )
    .single();

  if (error) return { error: error.message };

  revalidateProject(projectId);
  return { attachment: data as QaAttachmentRow };
}

export type QaAttachmentRow = {
  id: string;
  item_id: string;
  project_id: string;
  scope: QaAttachmentScope;
  attempt_id: string | null;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  sort_order: number;
};

export async function getQaScreenshotSignedUrlAction(
  attachmentId: string,
): Promise<{ error?: string; url?: string }> {
  await requireTestingAccess();
  if (!uuidSchema.safeParse(attachmentId).success) {
    return { error: "معرف غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("qa_test_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle<{ storage_path: string }>();

  if (error) return { error: error.message };
  if (!row) return { error: "الصورة غير موجودة" };

  const admin = createSupabaseAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("documents")
    .createSignedUrl(row.storage_path, 60 * 10);

  if (signError || !signed?.signedUrl) {
    return { error: signError?.message ?? "فشل إنشاء الرابط" };
  }
  return { url: signed.signedUrl };
}

export async function deleteQaScreenshotAction(
  attachmentId: string,
  projectId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const current = await requireTestingAccess();
  if (
    !uuidSchema.safeParse(attachmentId).success ||
    !uuidSchema.safeParse(projectId).success
  ) {
    return { error: "معرف غير صالح" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row, error } = await supabase
    .from("qa_test_attachments")
    .select("id, project_id, scope, attempt_id, storage_path")
    .eq("id", attachmentId)
    .eq("project_id", projectId)
    .maybeSingle<{
      id: string;
      project_id: string;
      scope: QaAttachmentScope;
      attempt_id: string | null;
      storage_path: string;
    }>();

  if (error) return { error: error.message };
  if (!row) return { error: "الصورة غير موجودة" };
  if (row.attempt_id != null) {
    return { error: "لا يمكن حذف صور السجل" };
  }

  if (row.scope === "item") {
    if (!canManageTesting(current.profile)) {
      return { error: "ليس لديك صلاحية الحذف" };
    }
  } else if (
    !canInteractWithTesting(current.profile) &&
    !canManageTesting(current.profile)
  ) {
    return { error: "غير مصرح" };
  }

  const { error: delError } = await supabase
    .from("qa_test_attachments")
    .delete()
    .eq("id", attachmentId)
    .is("attempt_id", null);

  if (delError) return { error: delError.message };

  const admin = createSupabaseAdminClient();
  await admin.storage.from("documents").remove([row.storage_path]);

  revalidateProject(projectId);
  return { ok: true };
}
