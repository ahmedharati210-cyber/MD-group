"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export type PaperDatesState = { error?: string; ok?: boolean };

const dateOrEmpty = z
  .string()
  .optional()
  .transform((s) => {
    const t = (s ?? "").trim();
    if (!t) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    return t;
  });

const updateDatesSchema = z.object({
  document_id: z.string().uuid(),
  issued_on: dateOrEmpty,
  expires_on: dateOrEmpty,
});

export async function updatePaperDatesAction(
  _prev: PaperDatesState | undefined,
  formData: FormData,
): Promise<PaperDatesState> {
  const { userId, profile } = await requireUser();
  const parsed = updateDatesSchema.safeParse({
    document_id: formData.get("document_id"),
    issued_on: formData.get("issued_on") ?? undefined,
    expires_on: formData.get("expires_on") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }
  const { document_id, issued_on, expires_on } = parsed.data;

  if (issued_on && expires_on && issued_on > expires_on) {
    return {
      error: "تاريخ الإصدار يجب أن يكون قبل أو في يوم انتهاء الصلاحية",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: doc, error: readErr } = await supabase
    .from("documents")
    .select(
      "id, company_id, owner_profile_id, expires_on, issued_on, expiry_notified_at, title",
    )
    .eq("id", document_id)
    .maybeSingle<{
      id: string;
      company_id: string;
      owner_profile_id: string | null;
      expires_on: string | null;
      issued_on: string | null;
      expiry_notified_at: string | null;
      title: string;
    }>();

  if (readErr || !doc) {
    return { error: "تعذر الوصول إلى الورقة" };
  }

  const isOwnerEmployee =
    profile.role === "employee" && doc.owner_profile_id === userId;
  const isManager =
    profile.is_super_admin ||
    profile.role === "md_admin" ||
    (profile.role === "company_manager" &&
      doc.company_id === profile.company_id);

  if (!isOwnerEmployee && !isManager) {
    return { error: "غير مصرح لك بتعديل هذه الورقة" };
  }

  let expiry_notified_at: string | null = doc.expiry_notified_at;
  if (expires_on !== doc.expires_on) {
    expiry_notified_at = null;
  }
  if (!expires_on) {
    expiry_notified_at = null;
  }

  const payload = {
    issued_on,
    expires_on,
    expiry_notified_at,
  };

  if (isOwnerEmployee) {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("documents")
      .update(payload)
      .eq("id", document_id)
      .eq("owner_profile_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("documents")
      .update(payload)
      .eq("id", document_id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/portal/papers/${document_id}`);
  revalidatePath("/portal/papers");
  if (doc.owner_profile_id) {
    revalidatePath(`/portal/employees/${doc.owner_profile_id}`);
  }
  revalidateTag("papers", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

export async function deletePaperAction(formData: FormData) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  // RLS will limit what this manager can read; admin still sees everything.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, company_id")
    .eq("id", id)
    .single<{ id: string; storage_path: string; company_id: string }>();

  if (!doc) {
    redirect(`/portal/papers?error=${encodeURIComponent("الملف غير موجود")}`);
  }

  if (
    current.profile.role === "company_manager" &&
    doc.company_id !== current.profile.company_id
  ) {
    redirect(
      `/portal/papers/${id}?error=${encodeURIComponent("صلاحيات غير كافية")}`,
    );
  }

  const admin = createSupabaseAdminClient();

  if (doc.storage_path) {
    await admin.storage.from("documents").remove([doc.storage_path]);
  }

  const { error } = await admin.from("documents").delete().eq("id", id);
  if (error) {
    redirect(
      `/portal/papers/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "document.delete",
    entity: "documents",
    entity_id: id,
  });

  revalidatePath("/portal/papers");
  revalidateTag("papers", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/papers");
}
