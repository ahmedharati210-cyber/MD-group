"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

const warningSchema = z.object({
  message: z.string().min(5, "الرسالة مطلوبة (5 أحرف على الأقل)"),
});

export async function sendWarningAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireUser();

  // Only managers and super admins can send warnings
  const canManage =
    profile.is_super_admin ||
    profile.role === "md_admin" ||
    profile.role === "company_manager";
  if (!canManage) return { error: "غير مصرح بإرسال الإنذارات" };

  const parsed = warningSchema.safeParse({ message: formData.get("message") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { message } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Super-admin broadcast to a whole company
  const broadcastCompanyId = formData.get("warning_company_id") as string | null;
  if (broadcastCompanyId && profile.is_super_admin) {
    const { error } = await supabase.from("warnings").insert({
      company_id: broadcastCompanyId,
      sender_id: userId,
      target_profile_id: null,
      message,
    });
    if (error) return { error: error.message };
    void logAudit(userId, "create", "warning", null, { broadcast_company: broadcastCompanyId });
    revalidatePath("/portal/warnings");
    return { ok: true };
  }

  // Multi-recipient: one or more employees selected via checkboxes
  const targetIds = formData.getAll("target_profile_ids").map(String).filter(Boolean);
  if (targetIds.length === 0) return { error: "يرجى تحديد موظف واحد على الأقل" };

  // Validate: company_manager can only warn employees in their own company
  if (profile.role === "company_manager") {
    const { data: targetProfiles } = await supabase
      .from("profiles")
      .select("id, company_id")
      .in("id", targetIds);
    const outsider = (targetProfiles ?? []).find((p) => p.company_id !== profile.company_id);
    if (outsider) return { error: "لا يمكنك إرسال إنذارات لموظفين خارج شركتك" };
  }

  // Resolve company_id from the first target (all should belong to same company for a manager)
  const { data: firstTarget } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", targetIds[0])
    .single<{ company_id: string | null }>();
  const company_id = firstTarget?.company_id ?? profile.company_id;
  if (!company_id) return { error: "لم يتم العثور على شركة الموظف" };

  // Insert one warning row per recipient
  const rows = targetIds.map((target_profile_id) => ({
    company_id,
    sender_id: userId,
    target_profile_id,
    message,
  }));

  const { error } = await supabase.from("warnings").insert(rows);
  if (error) return { error: error.message };

  void logAudit(userId, "create", "warning", null, {
    recipients: targetIds.length,
    company_id,
  });

  revalidatePath("/portal/warnings");
  return { ok: true };
}

export async function markWarningReadAction(id: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("warnings").update({ is_read: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/portal/warnings");
  return { ok: true };
}

export async function deleteWarningAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("warnings").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "warning", id);

  revalidatePath("/portal/warnings");
  return { ok: true };
}
