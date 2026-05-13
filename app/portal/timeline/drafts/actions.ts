"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DraftActionState = { error?: string; ok?: boolean };

const draftBodySchema = z.object({
  project_id: z.string().uuid("معرّف المشروع غير صالح"),
  body: z
    .string()
    .min(1, "النص مطلوب")
    .max(20_000, "النص طويل جداً"),
});

function revalidateDrafts() {
  revalidatePath("/portal/timeline/drafts");
}

export async function createDraftAction(
  _prev: DraftActionState | undefined,
  formData: FormData,
): Promise<DraftActionState> {
  const { userId } = await requireRole(["md_admin"]);
  const parsed = draftBodySchema.safeParse({
    project_id: formData.get("project_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const rawCat = formData.get("category_id");
  let categoryId: string | null = null;
  if (typeof rawCat === "string" && rawCat.trim().length > 0) {
    const catParsed = z.string().uuid().safeParse(rawCat.trim());
    if (!catParsed.success) {
      return { error: "معرّف المرحلة غير صالح" };
    }
    categoryId = catParsed.data;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("project_personal_drafts").insert({
    author_id: userId,
    project_id: parsed.data.project_id,
    category_id: categoryId,
    body: parsed.data.body,
  });
  if (error) return { error: error.message };

  revalidateDrafts();
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1, "النص مطلوب").max(20_000, "النص طويل جداً"),
});

export async function updateDraftAction(
  _prev: DraftActionState | undefined,
  formData: FormData,
): Promise<DraftActionState> {
  await requireUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_personal_drafts")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidateDrafts();
  return { ok: true };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteDraftAction(
  _prev: DraftActionState | undefined,
  formData: FormData,
): Promise<DraftActionState> {
  await requireUser();
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_personal_drafts")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidateDrafts();
  return { ok: true };
}
