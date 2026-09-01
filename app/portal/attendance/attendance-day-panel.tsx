"use client";

import type { DayRosterEntry } from "@/lib/attendance/attendance-view";
import {
  personDayStatusBadgeClass,
  personDayStatusLabel,
} from "@/lib/attendance/status-labels";
import {
  ABSENT_STATUS,
  HOLIDAY_LEAVE_TYPE,
} from "@/lib/attendance/leave-types";
import type { AttendanceShift } from "@/types/db";
import {
  AttendanceCreateLeaveForm,
  AttendanceRecordEditRow,
  DAY_PANEL_GRID_STYLE,
  DAY_PANEL_SUBGRID_ROW_CLASS,
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
  const record = entry.record;
  if (record) {
    // Include mutable fields so the edit row remounts after save (avoids stale useState/defaultValue).
    const payloadStamp = record.raw_payload
      ? JSON.stringify({
          mo: record.raw_payload.manually_overridden,
          wl: record.raw_payload.waive_late,
          we: record.raw_payload.waive_early_leave,
          ma: record.raw_payload.manual_absent,
          ml: record.raw_payload.manual_leave,
        })
      : "";
    return [
      record.id,
      record.leave_type ?? "",
      record.is_absent ? "1" : "0",
      record.first_check_in ?? "",
      record.last_check_out ?? "",
      record.shift_id ?? "",
      record.notes ?? "",
      payloadStamp,
    ].join("|");
  }
  return (
    entry.person?.id ??
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
      <div className="overflow-x-auto md:max-h-[480px] md:overflow-y-auto">
        <div
          className="hidden md:grid md:min-w-[40rem] w-full"
          style={DAY_PANEL_GRID_STYLE}
        >
          <div
            className={`${DAY_PANEL_SUBGRID_ROW_CLASS} px-4 py-2 text-[10px] font-semibold text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/40`}
          >
            <span>الدخول</span>
            <span>الخروج</span>
            <span>الوردية</span>
            <span>حالة اليوم</span>
            <span>ملاحظة</span>
            <span className="text-center">حفظ</span>
          </div>
          {entries.map((entry, index) => (
            <div
              key={entryKey(entry, index)}
              className="md:contents"
            >
              {entry.record ? (
                <AttendanceRecordEditRow
                  record={entry.record}
                  person={entry.person}
                  shifts={shifts}
                  isSuperAdmin={isSuperAdmin}
                  employeeName={entry.person?.full_name}
                  externalNumber={entry.person?.external_employee_number}
                />
              ) : entry.person ? (
                <>
                  <div className="md:col-span-full md:px-4 md:pt-3 md:pb-1 space-y-2">
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
                  </div>
                  <AttendanceCreateLeaveForm
                    date={date}
                    person={entry.person}
                    companyId={companyId}
                    branchId={branchId}
                    compact
                    defaultStatus={
                      entry.status === "absent" ? ABSENT_STATUS : HOLIDAY_LEAVE_TYPE
                    }
                  />
                </>
              ) : null}
            </div>
          ))}
        </div>
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry, index) => (
            <div key={entryKey(entry, index)} className="px-4 py-3">
            {entry.record ? (
              <AttendanceRecordEditRow
                record={entry.record}
                person={entry.person}
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
                  defaultStatus={
                    entry.status === "absent" ? ABSENT_STATUS : HOLIDAY_LEAVE_TYPE
                  }
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
