"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PersonMetricDayRow } from "@/lib/attendance/metric-drilldown";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: PersonMetricDayRow[];
  emptyMessage?: string;
};

function shortDate(date: string): string {
  return `${date.slice(8, 10)}-${date.slice(5, 7)}`;
}

export function AttendanceMetricDrilldownModal({
  open,
  onClose,
  title,
  rows,
  emptyMessage = "لا توجد أيام مطابقة",
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[85vh] flex flex-col"
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="font-bold text-gray-900 dark:text-gray-50 text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-500 text-center">
              {emptyMessage}
            </p>
          ) : (
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-gray-950/40 sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-500">التاريخ</th>
                  <th className="px-4 py-2 font-semibold text-gray-500">اليوم</th>
                  <th className="px-4 py-2 font-semibold text-gray-500">دخول</th>
                  <th className="px-4 py-2 font-semibold text-gray-500">خروج</th>
                  <th className="px-4 py-2 font-semibold text-gray-500">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-2.5 whitespace-nowrap" dir="ltr">
                      {shortDate(row.date)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{row.weekday}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-mono" dir="ltr">
                      {row.checkIn}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-mono" dir="ltr">
                      {row.checkOut}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-500 text-xs">{row.detailLabel}: </span>
                      <span className="font-medium">{row.detailValue}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
