"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

const warningSchema = z.object({
  message: z.string().min(5, "الرسالة مطلوبة (5 أحرف على الأقل)"),
  target_profile_id: z.string().uuid().optional().nullable(),
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

  const parsed = warningSchema.safeParse({
    message: formData.get("message"),
    target_profile_id: formData.get("target_profile_id") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { target_profile_id, message } = parsed.data;

  // Broadcast (null target) is restricted to super admins only
  if (!target_profile_id && !profile.is_super_admin) {
    return { error: "البث العام للجميع متاح للمشرف العام فقط" };
  }

  const supabase = await createSupabaseServerClient();
  let company_id: string | null = null;

  if (target_profile_id) {
    // Resolve the target employee's company
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", target_profile_id)
      .single<{ company_id: string | null }>();

    if (!targetProfile?.company_id) {
      return { error: "لم يتم العثور على شركة الموظف" };
    }
    company_id = targetProfile.company_id;

    // company_manager may only warn employees in their own company
    if (profile.role === "company_manager" && company_id !== profile.company_id) {
      return { error: "لا يمكنك إرسال إنذارات لموظفين خارج شركتك" };
    }
  } else {
    // Broadcast: super admin must choose which company receives the broadcast
    const broadcastCompanyId = formData.get("warning_company_id") as string | null;
    if (!broadcastCompanyId) return { error: "يرجى تحديد الشركة للبث العام" };
    company_id = broadcastCompanyId;
  }

  const { data: newWarning, error } = await supabase
    .from("warnings")
    .insert({ company_id, sender_id: userId, target_profile_id: target_profile_id ?? null, message })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "warning", newWarning?.id, {
    target_profile_id: target_profile_id ?? "broadcast",
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
