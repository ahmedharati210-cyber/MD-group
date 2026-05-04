"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

const claimSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون موجباً").optional().nullable(),
});

export async function createClaimAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireRole(["md_admin", "company_manager"]);
  const parsed = claimSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || null,
    amount: formData.get("amount") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  // Upload PDF file
  const file = formData.get("file") as File | null;
  let file_url: string | null = null;

  if (file && file.size > 0) {
    const supabase = await createSupabaseServerClient();
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `claims/${userId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
    if (uploadError) return { error: `فشل رفع الملف: ${uploadError.message}` };
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    file_url = urlData.publicUrl;
  }

  const company_id = profile.company_id;
  if (!company_id) {
    // md_admin — find the claims-enabled company
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("companies").select("id").contains("enabled_features", ["claims"]).limit(1).single();
    if (!data?.id) return { error: "لم يتم العثور على الشركة" };
  }

  const supabase = await createSupabaseServerClient();
  const resolvedCompanyId = profile.company_id ?? (await (async () => {
    const { data } = await supabase.from("companies").select("id").contains("enabled_features", ["claims"]).limit(1).single();
    return data?.id;
  })());

  if (!resolvedCompanyId) return { error: "لم يتم العثور على الشركة" };

  const { data: newClaim, error } = await supabase
    .from("manager_claims")
    .insert({ company_id: resolvedCompanyId, created_by: userId, file_url, ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "claim", newClaim?.id, { title: parsed.data.title });

  revalidatePath("/portal/claims");
  redirect("/portal/claims");
}

export async function deleteClaimAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("manager_claims").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "claim", id);

  redirect("/portal/claims");
}
