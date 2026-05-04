"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  full_name: z.string().min(2),
  title: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().optional().nullable(),
  company_id: z.string().uuid().optional().nullable().or(z.literal("")),
  trade_category: z.enum(["laborer", "technician", "mechanic", "electrician", "other"]).optional().nullable(),
});

export type ActionState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  return schema.safeParse({
    full_name: formData.get("full_name"),
    title: formData.get("title") || null,
    organization: formData.get("organization") || null,
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    notes: formData.get("notes") || null,
    company_id: formData.get("company_id") || null,
    trade_category: formData.get("trade_category") || null,
  });
}

export async function createContactAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const row = {
    ...parsed.data,
    email: parsed.data.email || null,
    company_id: parsed.data.company_id || null,
  };

  if (
    current.profile.role === "company_manager" &&
    row.company_id &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert(row)
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(current.userId, "create", "contact", newContact?.id, {
    full_name: parsed.data.full_name,
  });

  revalidatePath("/portal/contacts");
  redirect("/portal/contacts");
}

export async function updateContactAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "معرّف مفقود" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const row = {
    ...parsed.data,
    email: parsed.data.email || null,
    company_id: parsed.data.company_id || null,
  };

  if (
    current.profile.role === "company_manager" &&
    row.company_id &&
    row.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contacts").update(row).eq("id", id);
  if (error) return { error: error.message };

  void logAudit(current.userId, "update", "contact", id, {
    full_name: parsed.data.full_name,
  });

  revalidatePath("/portal/contacts");
  revalidatePath(`/portal/contacts/${id}/edit`);
  redirect("/portal/contacts");
}

export async function deleteContactAction(formData: FormData) {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("contacts").delete().eq("id", id);

  void logAudit(userId, "delete", "contact", id);

  revalidatePath("/portal/contacts");
}
