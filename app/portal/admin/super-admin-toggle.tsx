"use client";

import { useTransition } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";
import { setSuperAdminAction } from "./actions";

export function SuperAdminToggle({
  profileId,
  fullName,
  isSuperAdmin,
  isSelf,
}: {
  profileId: string;
  fullName: string;
  isSuperAdmin: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (isSelf) return;
    const action = isSuperAdmin ? "إزالة" : "منح";
    if (!confirm(`هل أنت متأكد من ${action} صلاحية Super Admin لـ ${fullName}؟`))
      return;

    startTransition(async () => {
      const res = await setSuperAdminAction(profileId, !isSuperAdmin);
      if (res.error) toast.error(res.error);
      else
        toast.success(
          isSuperAdmin
            ? `تم إزالة صلاحية Super Admin من ${fullName}`
            : `تم منح صلاحية Super Admin لـ ${fullName}`,
        );
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending || isSelf}
      title={isSelf ? "لا يمكن تغيير حسابك الخاص" : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
        isSuperAdmin
          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {isSuperAdmin ? (
        <>
          <ShieldCheck className="w-3.5 h-3.5" />
          Super Admin
        </>
      ) : (
        <>
          <ShieldOff className="w-3.5 h-3.5" />
          عادي
        </>
      )}
    </button>
  );
}
