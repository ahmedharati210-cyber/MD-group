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

export type WarningPushTarget = {
  profileId: string;
  warningId: string;
};

/** One Web Push per target with a unique notification tag (required for iOS banners). */
export async function dispatchWarningWebPushTargets(options: {
  kind: WarningKind;
  message: string;
  targets: WarningPushTarget[];
}): Promise<void> {
  const { kind, message, targets } = options;
  if (targets.length === 0) return;

  const body = truncateMessage(message);
  const title = pushTitleForKind(kind);

  await Promise.all(
    targets.map(({ profileId, warningId }) =>
      sendWebPushToUserIds([profileId], {
        title,
        body,
        url: "/portal/notifications",
        tag: `warning-${warningId}`,
        warningId,
      }),
    ),
  );
}

/** @deprecated Use dispatchWarningWebPushTargets — kept for callers passing profile ids only. */
export async function dispatchWarningWebPush(options: {
  kind: WarningKind;
  message: string;
  targetProfileIds: string[];
  warningId?: string;
}): Promise<void> {
  const { kind, message, targetProfileIds, warningId } = options;
  if (targetProfileIds.length === 0) return;

  const tagId = warningId ?? `bulk-${Date.now()}`;
  await sendWebPushToUserIds(targetProfileIds, {
    title: pushTitleForKind(kind),
    body: truncateMessage(message),
    url: "/portal/notifications",
    tag: `warning-${tagId}`,
    warningId: tagId,
  });
}

/** Company-wide broadcast (employees with active profiles in that company). */
export async function dispatchWarningWebPushBroadcast(options: {
  companyId: string;
  kind: WarningKind;
  message: string;
  warningId: string;
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
  if (ids.length === 0) return;

  await sendWebPushToUserIds(ids, {
    title: pushTitleForKind(options.kind),
    body: truncateMessage(options.message),
    url: "/portal/notifications",
    tag: `warning-${options.warningId}`,
    warningId: options.warningId,
  });
}
