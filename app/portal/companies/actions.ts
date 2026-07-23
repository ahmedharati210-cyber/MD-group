"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  isSlugUniqueViolation,
  resolveCompanySlug,
  withSlugSuffix,
} from "@/lib/companies/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean };

const companySchema = z.object({
  name_ar: z.string().min(2, "الاسم بالعربية مطلوب"),
  name_en: z.string().optional().nullable(),
  slug: z
    .string()
    .min(2, "المعرّف قصير جدًا")
    .regex(
      /^[a-z0-9-]+$/,
      "المعرّف يجب أن يحتوي على أحرف لاتينية وأرقام وشرطات فقط",
    ),
  logo_url: z.string().url().optional().nullable().or(z.literal("")),
  active: z.coerce.boolean().optional(),
});

function parseCompanyForm(formData: FormData) {
  const name_ar = String(formData.get("name_ar") ?? "");
  const name_en = (formData.get("name_en") as string) || null;
  const rawSlug = String(formData.get("slug") ?? "").trim();

  return companySchema.safeParse({
    name_ar,
    name_en,
    slug: resolveCompanySlug({
      slug: rawSlug || null,
      name_en,
      name_ar,
    }),
    logo_url: formData.get("logo_url") || null,
    active: formData.get("active") === "on",
  });
}

export async function createCompanyAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = parseCompanyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    name_ar: parsed.data.name_ar,
    name_en: parsed.data.name_en || null,
    slug: parsed.data.slug,
    logo_url: parsed.data.logo_url || null,
    active: parsed.data.active ?? true,
  };

  let { data, error } = await admin
    .from("companies")
    .insert(payload)
    .select("id")
    .single();

  if (error && isSlugUniqueViolation(error.message)) {
    const retry = await admin
      .from("companies")
      .insert({ ...payload, slug: withSlugSuffix(payload.slug) })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { error: error.message };
  if (!data) return { error: "تعذر إنشاء الشركة" };

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

  const parsed = parseCompanyForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    name_ar: parsed.data.name_ar,
    name_en: parsed.data.name_en || null,
    slug: parsed.data.slug,
    logo_url: parsed.data.logo_url || null,
    active: parsed.data.active ?? true,
  };

  let { error } = await admin.from("companies").update(payload).eq("id", id);

  if (error && isSlugUniqueViolation(error.message)) {
    const retry = await admin
      .from("companies")
      .update({ ...payload, slug: withSlugSuffix(payload.slug) })
      .eq("id", id);
    error = retry.error;
  }

  if (error) return { error: error.message };

  revalidatePath("/portal/companies");
  revalidatePath(`/portal/companies/${id}`);
  revalidatePath("/portal/attendance");
  revalidatePath("/");
  revalidateTag("companies", "default");
  revalidateTag("dashboard", "default");
  revalidateTag("public-companies", "default");
  revalidateTag(`company:${id}`, "default");
  revalidateTag("attendance", "default");
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
