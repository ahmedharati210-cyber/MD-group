"use client";

import type { DayRosterEntry } from "@/lib/attendance/attendance-view";
import {
  personDayStatusBadgeClass,
  personDayStatusLabel,
} from "@/lib/attendance/status-labels";
import type { AttendanceShift } from "@/types/db";
import {
  AttendanceCreateLeaveForm,
  AttendanceRecordEditRow,
  dayPanelFormGridClass,
} from "./attendance-record-edit-row";

const badgeBase =
  "text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap";

type Props = {
  date: string;
  entries: DayRosterEntry[];
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  hasSearch: boolean;
  companyId: string;
  branchId: string;
};

function entryKey(entry: DayRosterEntry, index: number): string {
  return (
    entry.person?.id ??
    entry.record?.id ??
    `${entry.record?.external_employee_number ?? "row"}-${index}`
  );
}

export function AttendanceDayPanel({
  date,
  entries,
  shifts,
  isSuperAdmin,
  hasSearch,
  companyId,
  branchId,
}: Props) {
  if (entries.length === 0) {
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

  const absentCount = entries.filter((entry) => entry.status === "absent").length;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
        سجلات {date} ({entries.length}
        {absentCount > 0 ? ` — ${absentCount} غياب` : ""})
      </h3>
      <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
        <div className="min-w-[40rem] divide-y divide-gray-100 dark:divide-gray-800">
          <div
            className={`grid ${dayPanelFormGridClass} px-4 py-2 text-[10px] font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40`}
          >
            <span>الدخول</span>
            <span>الخروج</span>
            <span>الوردية</span>
            <span>حالة اليوم</span>
            <span>ملاحظة</span>
            <span className="text-center">حفظ</span>
          </div>
          {entries.map((entry, index) => (
            <div key={entryKey(entry, index)} className="px-4 py-3">
            {entry.record ? (
              <AttendanceRecordEditRow
                record={entry.record}
                shifts={shifts}
                isSuperAdmin={isSuperAdmin}
                employeeName={entry.person?.full_name}
                externalNumber={entry.person?.external_employee_number}
              />
            ) : entry.person ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {entry.person.full_name}
                    </p>
                    <p className="text-xs text-gray-500" dir="ltr">
                      #{entry.person.external_employee_number}
                    </p>
                  </div>
                  <span
                    className={`${badgeBase} ${personDayStatusBadgeClass(entry.status)}`}
                  >
                    {personDayStatusLabel(entry.status, entry.leaveLabel)}
                  </span>
                </div>
                <AttendanceCreateLeaveForm
                  date={date}
                  person={entry.person}
                  companyId={companyId}
                  branchId={branchId}
                  compact
                />
              </div>
            ) : null}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
