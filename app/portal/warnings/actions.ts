"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireUser, requireRole } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import {
  dispatchWarningWebPush,
  dispatchWarningWebPushBroadcast,
} from "@/lib/push/dispatch-warning";

export type ActionState = { error?: string; ok?: boolean };

const warningKindSchema = z.enum(["warning", "notification"]);

const warningSchema = z.object({
  message: z.string().min(5, "الرسالة مطلوبة (5 أحرف على الأقل)"),
  kind: warningKindSchema,
});

function dispatchWarningWhatsApp(phones: string[], message: string) {
  const unique = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  for (const phone of unique) {
    void sendWhatsAppTemplate(phone, message);
  }
}

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
  if (!canManage) return { error: "غير مصرح بإرسال الإشعارات" };

  const rawKind = formData.get("kind");
  const parsed = warningSchema.safeParse({
    message: formData.get("message"),
    kind: typeof rawKind === "string" && rawKind ? rawKind : "warning",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const { message, kind } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Super-admin broadcast to a whole company
  const broadcastCompanyId = formData.get("warning_company_id") as string | null;
  if (broadcastCompanyId && profile.is_super_admin) {
    const { error } = await supabase.from("warnings").insert({
      company_id: broadcastCompanyId,
      sender_id: userId,
      target_profile_id: null,
      message,
      kind,
    });
    if (error) return { error: error.message };

    try {
      const admin = createSupabaseAdminClient();
      const { data: recipients } = await admin
        .from("profiles")
        .select("phone")
        .eq("company_id", broadcastCompanyId)
        .eq("role", "employee")
        .eq("is_active", true);
      const phones = (recipients ?? [])
        .map((r) => r.phone)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      dispatchWarningWhatsApp(phones, message);
    } catch (e) {
      console.error("[warnings] WhatsApp dispatch (broadcast) failed", e);
    }

    try {
      await dispatchWarningWebPushBroadcast({
        companyId: broadcastCompanyId,
        kind,
        message,
      });
    } catch (e) {
      console.error("[warnings] Web Push dispatch (broadcast) failed", e);
    }

    const adminForName = createSupabaseAdminClient();
    const { data: broadcastCo } = await adminForName
      .from("companies")
      .select("name")
      .eq("id", broadcastCompanyId)
      .maybeSingle<{ name: string }>();
    void logAudit(userId, "create", "warning", null, {
      ...(broadcastCo?.name ? { company_name: broadcastCo.name } : {}),
    });
    revalidatePath("/portal/notifications");
    revalidateTag("warnings", "default");
    revalidateTag("badges", "default");
    revalidateTag("dashboard", "default");
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
    if (outsider) return { error: "لا يمكنك إرسال إشعارات لموظفين خارج شركتك" };
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
    kind,
  }));

  const { error } = await supabase.from("warnings").insert(rows);
  if (error) return { error: error.message };

  try {
    const admin = createSupabaseAdminClient();
    const { data: recipients } = await admin
      .from("profiles")
      .select("phone")
      .in("id", targetIds);
    const phones = (recipients ?? [])
      .map((r) => r.phone)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    dispatchWarningWhatsApp(phones, message);
  } catch (e) {
    console.error("[warnings] WhatsApp dispatch failed", e);
  }

  try {
    await dispatchWarningWebPush({ kind, message, targetProfileIds: targetIds });
  } catch (e) {
    console.error("[warnings] Web Push dispatch failed", e);
  }

  const { data: targetCo } = await supabase
    .from("companies")
    .select("name")
    .eq("id", company_id)
    .maybeSingle<{ name: string }>();
  void logAudit(userId, "create", "warning", null, {
    recipients: targetIds.length,
    ...(targetCo?.name ? { company_name: targetCo.name } : {}),
  });

  revalidatePath("/portal/notifications");
  revalidateTag("warnings", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

export async function markWarningReadAction(id: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("warnings").update({ is_read: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/portal/notifications");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

/** Employees only: mark every visible unread row (direct + company broadcast) as read. */
export async function markAllWarningsReadAction(): Promise<ActionState> {
  const { userId, profile } = await requireUser();
  if (profile.role !== "employee") {
    return { error: "هذا الإجراء متاح للموظفين فقط" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("warnings")
    .update({ is_read: true })
    .eq("is_read", false)
    .or(`target_profile_id.eq.${userId},target_profile_id.is.null`);

  if (error) return { error: error.message };

  revalidatePath("/portal/notifications");
  revalidateTag("warnings", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}

export async function deleteWarningAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("warnings").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "warning", id);

  revalidatePath("/portal/notifications");
  revalidateTag("warnings", "default");
  revalidateTag("badges", "default");
  revalidateTag("dashboard", "default");
  return { ok: true };
}
