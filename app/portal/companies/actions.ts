"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

const companySchema = z.object({
  name_ar: z.string().min(2, "الاسم بالعربية مطلوب"),
  name_en: z.string().optional().nullable(),
  slug: z
    .string()
    .min(2, "المعرّف قصير جدًا")
    .regex(/^[a-z0-9-]+$/, "المعرّف يجب أن يحتوي على أحرف لاتينية صغيرة وأرقام وشرطات فقط"),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
  active: z.coerce.boolean().optional(),
});

export async function createCompanyAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = companySchema.safeParse({
    name_ar: formData.get("name_ar"),
    name_en: formData.get("name_en") || null,
    slug: formData.get("slug"),
    logo_url: formData.get("logo_url") || null,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("companies")
    .insert({
      name_ar: parsed.data.name_ar,
      name_en: parsed.data.name_en || null,
      slug: parsed.data.slug,
      logo_url: parsed.data.logo_url || null,
      active: parsed.data.active ?? true,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/portal/companies");
  revalidatePath("/");
  revalidateTag("companies", "default");
  revalidateTag("dashboard", "default");
  revalidateTag("public-companies", "default");
  redirect(`/portal/companies/${data.id}`);
}

export async function updateCompanyAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const id = formData.get("id");
  if (typeof id !== "string") return { error: "معرّف مفقود" };

  const parsed = companySchema.safeParse({
    name_ar: formData.get("name_ar"),
    name_en: formData.get("name_en") || null,
    slug: formData.get("slug"),
    logo_url: formData.get("logo_url") || null,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("companies")
    .update({
      name_ar: parsed.data.name_ar,
      name_en: parsed.data.name_en || null,
      slug: parsed.data.slug,
      logo_url: parsed.data.logo_url || null,
      active: parsed.data.active ?? true,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/portal/companies");
  revalidatePath(`/portal/companies/${id}`);
  revalidatePath("/");
  revalidateTag("companies", "default");
  revalidateTag("dashboard", "default");
  revalidateTag("public-companies", "default");
  revalidateTag(`company:${id}`, "default");
  redirect(`/portal/companies/${id}`);
}

export async function deleteCompanyAction(formData: FormData) {
  await requireSuperAdmin();
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const admin = createSupabaseAdminClient();

  // Guard: refuse if the company still has employees/managers attached.
  const { count: profileCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id);

  if ((profileCount ?? 0) > 0) {
    redirect(
      `/portal/companies/${id}?error=${encodeURIComponent(
        "لا يمكن حذف الشركة وبها موظفون. قم بنقل أو حذف المستخدمين أولاً.",
      )}`,
    );
  }

  const { error } = await admin.from("companies").delete().eq("id", id);
  if (error) {
    redirect(
      `/portal/companies/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/portal/companies");
  revalidatePath("/");
  revalidateTag("companies", "default");
  revalidateTag("dashboard", "default");
  revalidateTag("public-companies", "default");
  revalidateTag(`company:${id}`, "default");
  redirect("/portal/companies");
}
