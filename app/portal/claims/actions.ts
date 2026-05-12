"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";

export type ActionState = { error?: string; ok?: boolean };

const claimSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون موجباً").optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
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
    project_id: formData.get("project_id") || null,
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
    // Store the storage path; signed URLs are generated on demand in the detail page.
    file_url = path;
  }

  const supabase = await createSupabaseServerClient();

  const resolvedCompanyId = await getShellCompanyIdForProfile(profile);
  if (!resolvedCompanyId) return { error: "لم يتم العثور على الشركة" };

  const { data: newClaim, error } = await supabase
    .from("manager_claims")
    .insert({ company_id: resolvedCompanyId, created_by: userId, file_url, ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "claim", newClaim?.id, { title: parsed.data.title });

  revalidatePath("/portal/claims");
  revalidateTag("claims", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/claims");
}

export async function deleteClaimAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("manager_claims").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "claim", id);

  revalidateTag("claims", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/claims");
}
