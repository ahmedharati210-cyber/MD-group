"use client";

import { useEffect } from "react";
import { getPortalServiceWorkerRegistration } from "@/lib/push/portal-sw";
import { arrayBufferToBase64Url, isPushSupported } from "@/lib/push/client";

/**
 * On portal mount, if the browser already holds a push subscription, silently
 * POST it to /api/push/subscribe. The endpoint upserts on the `endpoint` column
 * and sets user_id to whoever is currently authenticated, so this atomically
 * re-binds any stale subscription (e.g. left over from a previous account on
 * the same device) to the logged-in user.
 *
 * This is a fire-and-forget background operation — errors are swallowed.
 */
export function usePushRebind(): void {
  useEffect(() => {
    if (!isPushSupported()) return;

    void (async () => {
      try {
        const reg = await getPortalServiceWorkerRegistration();
        if (!reg) return;

        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;

        const p256dh = sub.getKey("p256dh");
        const auth = sub.getKey("auth");
        if (!p256dh || !auth) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: arrayBufferToBase64Url(p256dh),
              auth: arrayBufferToBase64Url(auth),
            },
          }),
        });
      } catch {
        // Silent — push rebind is best-effort and must not affect the portal.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
