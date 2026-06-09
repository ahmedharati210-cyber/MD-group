"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useEnableWebPush } from "@/lib/hooks/use-enable-web-push";
import { useIsStandalone } from "@/lib/hooks/use-is-standalone";

export function PushNotificationsCard() {
  const isStandalone = useIsStandalone();
  const { status, busy, endpoint, enable, disable } = useEnableWebPush();

  async function handleEnable() {
    const result = await enable();
    if (result === "granted") {
      toast.success("تم تفعيل الإشعارات");
    } else if (result === "denied") {
      toast.error("تم رفض إذن الإشعارات");
    } else if (result === "unconfigured") {
      toast.error("الإشعارات غير مفعّلة على الخادم");
    } else if (result === "error" || result === "unsupported") {
      toast.error("تعذّر تفعيل الإشعارات");
    }
  }

  async function handleDisable() {
    const ok = await disable();
    if (ok) {
      toast.success("تم إيقاف الإشعارات");
    } else {
      toast.error("تعذّر إيقاف الإشعارات");
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
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
          المتصفح لا يدعم الإشعارات، أو لم يُسجَّل التطبيق بعد.
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

      {isStandalone && status === "on" ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          للتنبيه على شاشة القفل: فعّل الإشعارات من إعدادات الجهاز، أبقِ التطبيق في الخلفية عند
          الاختبار، وحدّث التطبيق بعد كل نشر جديد.
        </p>
      ) : null}

      {status === "off" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleEnable()}
          className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          تفعيل الإشعارات
        </button>
      ) : null}

      {status === "on" ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <Bell className="w-4 h-4 shrink-0" />
            الإشعارات مفعّلة على هذا الجهاز
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleDisable()}
            className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
            إيقاف
          </button>
          {endpoint ? <span className="sr-only">مشترك</span> : null}
        </div>
      ) : null}
    </div>
  );
}
