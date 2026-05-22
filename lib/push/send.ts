import "server-only";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getVapidPublicKey, getVapidSubject, isWebPushConfigured } from "@/lib/push/config";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (!isWebPushConfigured()) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      getVapidSubject(),
      getVapidPublicKey()!,
      process.env.VAPID_PRIVATE_KEY!.trim(),
    );
    vapidConfigured = true;
  }
  return true;
}

async function removeSubscriptionById(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("push_subscriptions").delete().eq("id", id);
}

/**
 * Sends a Web Push to all devices registered for the given profile IDs.
 * Removes expired subscriptions (410/404). No-op when VAPID is not configured.
 */
export async function sendWebPushToUserIds(
  userIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfigured() || userIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueIds);

  if (error) {
    console.error("[web-push] load subscriptions", error.message);
    return { sent: 0, failed: 0 };
  }

  const subscriptionRows = (rows ?? []) as PushSubscriptionRow[];
  if (subscriptionRows.length === 0) {
    console.info(
      "[web-push] skipped: no registered devices for",
      uniqueIds.length,
      "recipient profile(s). Enable الإشعارات on the recipient phone, or select them when sending.",
    );
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/portal/notifications",
    tag: payload.tag,
  });

  let sent = 0;
  let failed = 0;

  for (const row of subscriptionRows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
        { TTL: 60 * 60 * 24 },
      );
      sent += 1;
    } catch (e: unknown) {
      failed += 1;
      const err = e as { statusCode?: number; body?: string };
      const status = err.statusCode;
      const isBadVapid =
        status === 403 &&
        typeof err.body === "string" &&
        err.body.includes("BadJwtToken");
      if (status === 404 || status === 410 || isBadVapid) {
        if (isBadVapid) {
          console.warn(
            "[web-push] removed stale subscription (VAPID key/subject mismatch — re-enable in الإعدادات)",
            row.endpoint.slice(0, 48),
          );
        }
        await removeSubscriptionById(row.id);
      } else {
        console.error("[web-push] send failed", row.endpoint.slice(0, 48), e);
      }
    }
  }

  if (sent > 0 || failed > 0) {
    console.info(`[web-push] delivered ${sent}, failed ${failed}`);
  }

  return { sent, failed };
}
