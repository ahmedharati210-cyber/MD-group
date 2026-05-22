"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getPortalServiceWorkerRegistration } from "@/lib/push/portal-sw";
import {
  arrayBufferToBase64Url,
  isPushSupported,
  urlBase64ToUint8Array,
} from "@/lib/push/client";
import { useIsStandalone } from "@/lib/hooks/use-is-standalone";

type Status = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied";

export function PushNotificationsCard() {
  const isStandalone = useIsStandalone();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    const keyRes = await fetch("/api/push/vapid-public-key");
    if (!keyRes.ok) {
      setStatus("unconfigured");
      return;
    }

    const reg = await getPortalServiceWorkerRegistration();
    if (!reg) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      setEndpoint(sub.endpoint);
      setStatus("on");
    } else {
      setEndpoint(null);
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enablePush() {
    setBusy(true);
    try {
      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) {
        toast.error("إشعارات الدفع غير مفعّلة على الخادم");
        setStatus("unconfigured");
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        toast.error("تم رفض إذن الإشعارات");
        return;
      }

      const reg = await getPortalServiceWorkerRegistration();
      if (!reg) {
        toast.error("تعذّر تسجيل التطبيق");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")!),
            auth: arrayBufferToBase64Url(sub.getKey("auth")!),
          },
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "subscribe failed");
      }

      setEndpoint(sub.endpoint);
      setStatus("on");
      toast.success("تم تفعيل إشعارات الدفع");
    } catch (e) {
      console.error(e);
      toast.error("تعذّر تفعيل الإشعارات");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const reg = await getPortalServiceWorkerRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEndpoint(null);
      setStatus("off");
      toast.success("تم إيقاف إشعارات الدفع");
    } catch (e) {
      console.error(e);
      toast.error("تعذّر إيقاف الإشعارات");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-1">
        إشعارات الجهاز
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        تنبيهات على شاشة القفل عند إرسال تنبيه أو إشعار جديد (يتطلب تفعيل الإذن).
      </p>

      {status === "loading" ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري التحقق…
        </div>
      ) : null}

      {status === "unsupported" ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          المتصفح لا يدعم إشعارات الدفع، أو لم يُسجَّل التطبيق بعد.
        </p>
      ) : null}

      {status === "unconfigured" ? (
        <p className="text-sm text-gray-500">
          الخادم لم يُعدّ لمفاتيح VAPID بعد. أضف{" "}
          <code className="text-xs">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> و{" "}
          <code className="text-xs">VAPID_PRIVATE_KEY</code> في البيئة.
        </p>
      ) : null}

      {status === "denied" ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          الإذن مرفوض. فعّل الإشعارات من إعدادات المتصفح أو الجهاز ثم أعد المحاولة.
        </p>
      ) : null}

      {!isStandalone && status !== "unsupported" && status !== "unconfigured" ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          على iPhone: ثبّت التطبيق على الشاشة الرئيسية أولاً لتلقي الإشعارات (iOS 16.4+).
        </p>
      ) : null}

      {status === "off" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enablePush()}
          className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          تفعيل إشعارات الدفع
        </button>
      ) : null}

      {status === "on" ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Bell className="w-4 h-4 flex-shrink-0" />
            الإشعارات مفعّلة على هذا الجهاز
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disablePush()}
            className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
            إيقاف
          </button>
          {endpoint ? (
            <span className="sr-only">مشترك</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
