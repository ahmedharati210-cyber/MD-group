"use client";

import { useTransition } from "react";
import { Monitor, MonitorOff } from "lucide-react";
import toast from "react-hot-toast";
import { setTestingAccessAction } from "./actions";

export function TestingAccessToggle({
  profileId,
  fullName,
  enabled,
}: {
  profileId: string;
  fullName: string;
  enabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const action = enabled ? "إيقاف" : "تفعيل";
    if (
      !confirm(
        `هل أنت متأكد من ${action} وصول المنظومات والمواقع لـ ${fullName}؟`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await setTestingAccessAction(profileId, !enabled);
      if (res.error) toast.error(res.error);
      else
        toast.success(
          enabled
            ? `تم إيقاف المنظومات والمواقع لـ ${fullName}`
            : `تم تفعيل المنظومات والمواقع لـ ${fullName}`,
        );
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      title={
        enabled
          ? "المنظومات والمواقع مفعّلة"
          : "المنظومات والمواقع معطّلة"
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
        enabled
          ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {enabled ? (
        <>
          <Monitor className="w-3.5 h-3.5" />
          المنظومات والمواقع
        </>
      ) : (
        <>
          <MonitorOff className="w-3.5 h-3.5" />
          بدون منظومات
        </>
      )}
    </button>
  );
}
