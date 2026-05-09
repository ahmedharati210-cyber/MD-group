"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const mailSchema = z.object({
  company_id: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  subject: z.string().min(1),
  body: z.string().optional().nullable(),
  from_name: z.string().optional().nullable(),
  to_name: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  related_document_id: z.string().uuid().optional().nullable(),
});

export type ActionState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  return mailSchema.safeParse({
    company_id: formData.get("company_id"),
    direction: formData.get("direction"),
    subject: formData.get("subject"),
    body: formData.get("body") || null,
    from_name: formData.get("from_name") || null,
    to_name: formData.get("to_name") || null,
    status: formData.get("status") || null,
    related_document_id: formData.get("related_document_id") || null,
  });
}

export async function createMailAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const current = await requireRole(["md_admin", "company_manager"]);

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }
  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("mail").insert({
    ...parsed.data,
    created_by: current.userId,
  });
  if (error) return { error: error.message };

  revalidatePath("/portal/mail");
  revalidateTag("mail", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/mail");
}

export async function updateMailAction(
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
  if (
    current.profile.role === "company_manager" &&
    parsed.data.company_id !== current.profile.company_id
  ) {
    return { error: "صلاحيات غير كافية" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("mail")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/portal/mail");
  revalidatePath(`/portal/mail/${id}`);
  revalidateTag("mail", "default");
  revalidateTag("dashboard", "default");
  redirect(`/portal/mail/${id}`);
}

export async function deleteMailAction(formData: FormData) {
  await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("mail").delete().eq("id", id);
  if (error) {
    redirect(`/portal/mail/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/portal/mail");
  revalidateTag("mail", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/mail");
}
