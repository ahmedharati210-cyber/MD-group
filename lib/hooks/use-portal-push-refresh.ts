"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncPortalAppBadge } from "@/lib/push/sync-app-badge";

const REFRESH_DEBOUNCE_MS = 400;

type SwMessage = {
  type?: string;
  url?: string;
};

/** Refresh portal RSC data when push arrives or app returns to foreground. */
export function usePortalPushRefresh(): void {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function scheduleRefresh(url?: string) {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (url) {
          router.push(url);
        } else {
          router.refresh();
        }
        void syncPortalAppBadge();
      }, REFRESH_DEBOUNCE_MS);
    }

    function onSwMessage(event: MessageEvent<SwMessage>) {
      if (event.data?.type === "PORTAL_REFRESH") {
        scheduleRefresh(event.data.url);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    }

    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);
}
