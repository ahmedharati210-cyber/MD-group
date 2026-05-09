"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

const requestSchema = z.object({
  request_type: z.enum(["vacation", "day_off", "advance", "equipment", "other"]),
  description: z.string().min(5, "الوصف مطلوب (5 أحرف على الأقل)"),
  requested_date: z.string().optional().nullable(),
});

export async function createRequestAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireUser();
  const parsed = requestSchema.safeParse({
    request_type: formData.get("request_type"),
    description: formData.get("description"),
    requested_date: formData.get("requested_date") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  if (!profile.company_id) return { error: "لم يتم تحديد الشركة" };

  const supabase = await createSupabaseServerClient();
  const { data: newReq, error } = await supabase
    .from("engineer_requests")
    .insert({ company_id: profile.company_id, requester_id: userId, ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "request", newReq?.id, {
    request_type: parsed.data.request_type,
  });

  revalidatePath("/portal/requests");
  revalidateTag("requests", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/requests");
}

export async function respondToRequestAction(
  requestId: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const status = formData.get("status") as string;
  if (!["approved", "rejected"].includes(status)) return { error: "قرار غير صالح" };

  const supabase = await createSupabaseServerClient();
  const respondedAt = new Date().toISOString();
  const { error } = await supabase
    .from("engineer_requests")
    .update({
      status,
      manager_response: (formData.get("manager_response") as string) || null,
      responded_by: userId,
      responded_at: respondedAt,
    })
    .eq("id", requestId);
  if (error) return { error: error.message };

  void logAudit(userId, "update", "request", requestId, {
    status,
    responded_at: respondedAt,
  });

  revalidatePath(`/portal/requests/${requestId}`);
  revalidatePath("/portal/requests");
  revalidateTag("requests", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

export async function deleteRequestAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("engineer_requests").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "request", id);

  revalidateTag("requests", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/requests");
}
