"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { getPortalServiceWorkerRegistration } from "@/lib/push/portal-sw";

export function PwaSwUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPortalServiceWorkerRegistration().then((reg) => {
      if (!reg || cancelled) return;

      if (reg.waiting) {
        setWaiting(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(reg.waiting);
          }
        });
      });
    });

    const onControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function applyUpdate() {
    waiting?.postMessage({ type: "SKIP_WAITING" });
  }

  if (!waiting) return null;

  return (
    <div
      className="print:hidden w-full bg-gray-900 text-white px-4 py-3 z-60 pt-[max(0.75rem,env(safe-area-inset-top))]"
      dir="rtl"
      role="status"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <p className="flex-1 text-sm font-medium">يتوفر تحديث للتطبيق</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="inline-flex items-center gap-1.5 min-h-11 px-3.5 py-2 bg-white text-gray-900 rounded-lg text-sm font-bold hover:bg-white/90"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث الآن
        </button>
        <button
          type="button"
          onClick={() => setWaiting(null)}
          aria-label="إغلاق"
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg hover:bg-white/20"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
