"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useEnableWebPush } from "@/lib/hooks/use-enable-web-push";
import { useIsStandalone } from "@/lib/hooks/use-is-standalone";
import {
  dismissPushOptIn,
  shouldShowPushOptIn,
} from "@/lib/push/enable-push";

export function PushOptInModal() {
  const isStandalone = useIsStandalone();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const { busy, enable } = useEnableWebPush({ silent: true });

  useEffect(() => {
    let cancelled = false;
    setChecking(true);

    void shouldShowPushOptIn(isStandalone).then((show) => {
      if (!cancelled) {
        setOpen(show);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isStandalone]);

  function handleDismiss() {
    dismissPushOptIn();
    setOpen(false);
  }

  async function handleEnable() {
    const result = await enable();
    if (result === "granted") {
      toast.success("تم تفعيل الإشعارات");
      setOpen(false);
      return;
    }
    if (result === "denied") {
      toast.error("تم رفض الإشعارات. يمكنك تفعيلها لاحقاً من إعدادات الجهاز.");
      dismissPushOptIn();
      setOpen(false);
      return;
    }
    if (result === "unconfigured") {
      toast.error("الإشعارات غير مفعّلة على الخادم");
      setOpen(false);
      return;
    }
    toast.error("تعذّر تفعيل الإشعارات");
  }

  if (checking || !open) return null;

  return (
    <div
      className="print:hidden fixed inset-0 z-70 flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      role="presentation"
    >
      <button
        type="button"
        aria-label="إغلاق"
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={handleDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-opt-in-title"
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6"
        dir="rtl"
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="إغلاق"
          className="absolute left-4 top-4 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-4">
          <Bell className="w-6 h-6 text-primary-700 dark:text-primary-300" />
        </div>

        <h2
          id="push-opt-in-title"
          className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2 pe-8"
        >
          فعّل الإشعارات
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          لتصلك التنبيهات والإشعارات الجديدة على شاشة القفل حتى عندما لا يكون التطبيق مفتوحاً،
          اضغط تفعيل ثم اختر «السماح» في نافذة النظام.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            لاحقاً
          </button>
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={busy}
            className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            تفعيل الإشعارات
          </button>
        </div>
      </div>
    </div>
  );
}
