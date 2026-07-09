"use client";

import type { AttendanceMonthlyRecord, AttendanceShift } from "@/types/db";
import {
  AttendanceRecordEditRow,
} from "./attendance-record-edit-row";

type Props = {
  date: string;
  records: AttendanceMonthlyRecord[];
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  hasSearch: boolean;
};

export function AttendanceDayPanel({
  date,
  records,
  shifts,
  isSuperAdmin,
  hasSearch,
}: Props) {
  if (records.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="font-bold mb-2">سجلات {date}</h3>
        <p className="text-sm text-gray-500">
          {hasSearch
            ? "لا توجد سجلات مطابقة للبحث في هذا اليوم."
            : "لا توجد سجلات لهذا اليوم."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
        سجلات {date} ({records.length})
      </h3>
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[480px] overflow-y-auto">
        {records.map((record) => (
          <div key={record.id} className="p-4">
            <AttendanceRecordEditRow
              record={record}
              shifts={shifts}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
