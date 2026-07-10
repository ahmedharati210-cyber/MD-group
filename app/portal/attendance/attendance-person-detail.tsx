"use client";

import Link from "next/link";
import { X } from "lucide-react";

type Props = {
  personName: string;
  externalNumber: string;
  recordCount: number;
  leaveDays?: number;
  closeHref?: string | null;
};

export function AttendancePersonHeader({
  personName,
  externalNumber,
  recordCount,
  leaveDays,
  closeHref = null,
}: Props) {
  return (
    <div
      id="person-attendance-view"
      className="flex items-start justify-between gap-3 mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
    >
      <div>
        <h3 className="font-bold text-lg">{personName}</h3>
        <p className="text-sm text-gray-500" dir="ltr">
          #{externalNumber} — {recordCount} سجل هذا الشهر
          {leaveDays != null && leaveDays > 0 ? ` — إجازات: ${leaveDays}` : ""}
        </p>
      </div>
      {closeHref ? (
        <Link
          href={closeHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 shrink-0"
        >
          <X className="w-4 h-4" />
          إغلاق
        </Link>
      ) : null}
    </div>
  );
}
