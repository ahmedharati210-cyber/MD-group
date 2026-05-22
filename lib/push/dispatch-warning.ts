import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendWebPushToUserIds } from "@/lib/push/send";
import type { WarningKind } from "@/types/db";

function pushTitleForKind(kind: WarningKind): string {
  return kind === "notification" ? "إشعار — MD Group" : "تنبيه — MD Group";
}

function truncateMessage(message: string, max = 140): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Notify target employees via Web Push when a warning/notification is created. */
export async function dispatchWarningWebPush(options: {
  kind: WarningKind;
  message: string;
  targetProfileIds: string[];
}): Promise<void> {
  const { kind, message, targetProfileIds } = options;
  if (targetProfileIds.length === 0) return;

  await sendWebPushToUserIds(targetProfileIds, {
    title: pushTitleForKind(kind),
    body: truncateMessage(message),
    url: "/portal/notifications",
    tag: `warning-${kind}`,
  });
}

/** Company-wide broadcast (employees with active profiles in that company). */
export async function dispatchWarningWebPushBroadcast(options: {
  companyId: string;
  kind: WarningKind;
  message: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", options.companyId)
    .eq("role", "employee")
    .eq("is_active", true);

  if (error) {
    console.error("[web-push] broadcast profiles", error.message);
    return;
  }

  const ids = (profiles ?? []).map((p) => p.id).filter(Boolean);
  await dispatchWarningWebPush({
    kind: options.kind,
    message: options.message,
    targetProfileIds: ids,
  });
}
