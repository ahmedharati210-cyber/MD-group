"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

const selectCls =
  "px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

export function RequestsFilter({
  isManager,
  currentStatus,
  currentType,
  currentCompanyId = "",
}: {
  isManager: boolean;
  currentStatus: string;
  currentType: string;
  currentCompanyId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(key: string, value: string) {
    const next = new URLSearchParams();
    const merged: Record<string, string> = {
      status: currentStatus,
      type: currentType,
      companyId: currentCompanyId,
      [key]: value,
    };
    Object.entries(merged).forEach(([k, v]) => { if (v) next.set(k, v); });
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function clearAll() {
    router.replace(pathname, { scroll: false });
  }

  const hasFilter = !!currentStatus || !!currentType || !!currentCompanyId;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <select value={currentStatus} onChange={(e) => update("status", e.target.value)} className={selectCls}>
        <option value="">كل الحالات</option>
        <option value="pending">قيد الانتظار</option>
        <option value="approved">موافق عليه</option>
        <option value="rejected">مرفوض</option>
      </select>

      {isManager ? (
        <select value={currentType} onChange={(e) => update("type", e.target.value)} className={selectCls}>
          <option value="">كل الأنواع</option>
          <option value="vacation">إجازة</option>
          <option value="day_off">يوم راحة</option>
          <option value="advance">سلفة</option>
          <option value="equipment">معدات</option>
          <option value="other">أخرى</option>
        </select>
      ) : null}

      {hasFilter ? (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          مسح
        </button>
      ) : null}
    </div>
  );
}
