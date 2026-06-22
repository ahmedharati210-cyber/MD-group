import "server-only";

import { revalidateTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { dispatchWarningWebPushTargets } from "@/lib/push/dispatch-warning";

export async function dispatchProjectNotification(options: {
  companyId: string;
  message: string;
  senderId: string;
}): Promise<void> {
  const { companyId, message, senderId } = options;
  const admin = createSupabaseAdminClient();

  const { data: managers, error: profilesErr } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("project_notifications_enabled", true)
    .in("role", ["company_manager", "md_admin"])
    .eq("is_active", true);

  if (profilesErr) {
    console.error("[project-notification] profiles", profilesErr.message);
    return;
  }

  const recipients = (managers ?? []).map((m) => m.id).filter(Boolean);
  if (recipients.length === 0) return;

  const rows = recipients.map((profileId) => ({
    company_id: companyId,
    sender_id: senderId,
    target_profile_id: profileId,
    message,
    kind: "notification" as const,
  }));

  const { data: inserted, error: insertErr } = await admin
    .from("warnings")
    .insert(rows)
    .select("id, target_profile_id");

  if (insertErr) {
    console.error("[project-notification] insert warnings", insertErr.message);
    return;
  }

  const targets = (inserted ?? [])
    .filter((row): row is { id: string; target_profile_id: string } =>
      Boolean(row.id && row.target_profile_id),
    )
    .map((row) => ({
      profileId: row.target_profile_id,
      warningId: row.id,
    }));

  if (targets.length > 0) {
    await dispatchWarningWebPushTargets({
      kind: "notification",
      message,
      targets,
    });
  }

  revalidateTag("warnings", "default");
  revalidateTag("badges", "default");
}
