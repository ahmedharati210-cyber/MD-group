"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { diffFields, logAudit } from "@/lib/audit";
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
  const { data, error } = await supabase
    .from("mail")
    .insert({
      ...parsed.data,
      created_by: current.userId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(current.userId, "create", "mail", data?.id ?? null, {
    subject: parsed.data.subject,
    direction: parsed.data.direction,
    status: parsed.data.status,
  });

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
  const { data: existing } = await supabase
    .from("mail")
    .select("subject, status, direction, to_name, from_name")
    .eq("id", id)
    .maybeSingle<{
      subject: string;
      status: string | null;
      direction: string;
      to_name: string | null;
      from_name: string | null;
    }>();

  const { error } = await supabase
    .from("mail")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: error.message };

  if (existing) {
    const diff = diffFields(
      {
        subject: existing.subject,
        status: existing.status,
        direction: existing.direction,
        to_name: existing.to_name,
        from_name: existing.from_name,
      },
      {
        subject: parsed.data.subject,
        status: parsed.data.status ?? null,
        direction: parsed.data.direction,
        to_name: parsed.data.to_name ?? null,
        from_name: parsed.data.from_name ?? null,
      },
      ["subject", "status", "direction", "to_name", "from_name"],
    );
    if (Object.keys(diff).length > 0) {
      void logAudit(current.userId, "update", "mail", id, diff);
    }
  }

  revalidatePath("/portal/mail");
  revalidatePath(`/portal/mail/${id}`);
  revalidateTag("mail", "default");
  revalidateTag("dashboard", "default");
  redirect(`/portal/mail/${id}`);
}

export async function deleteMailAction(formData: FormData) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("mail")
    .select("subject")
    .eq("id", id)
    .maybeSingle<{ subject: string }>();

  const { error } = await supabase.from("mail").delete().eq("id", id);
  if (error) {
    redirect(`/portal/mail/${id}?error=${encodeURIComponent(error.message)}`);
  }

  void logAudit(current.userId, "delete", "mail", id, {
    subject: existing?.subject ?? null,
  });

  revalidatePath("/portal/mail");
  revalidateTag("mail", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/mail");
}
