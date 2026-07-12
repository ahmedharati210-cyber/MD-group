"use client";

import type { DaySummary } from "@/lib/attendance/calendar-shared";
import { ABSENT_STATUS, HOLIDAY_LEAVE_TYPE } from "@/lib/attendance/leave-types";
import type { AttendancePerson, AttendanceShift } from "@/types/db";
import {
  personDayStatusBadgeClass,
  personDayStatusLabel,
} from "@/lib/attendance/status-labels";
import {
  AttendanceCreateLeaveMobileCard,
  AttendanceCreateLeaveTableRow,
  AttendanceRecordMobileCard,
  AttendanceRecordTableRow,
  PERSON_MONTH_GRID_STYLE,
  PERSON_MONTH_SUBGRID_ROW_CLASS,
  PERSON_MONTH_TH,
  type DayTableMeta,
} from "./attendance-record-edit-row";

const AR_DAYS = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function weekdayLabel(date: string): string {
  return AR_DAYS[new Date(`${date}T12:00:00`).getDay()];
}

function shortDate(date: string): string {
  return `${date.slice(8, 10)}-${date.slice(5, 7)}`;
}

function statusBadgeClass(day: DaySummary): string {
  if (day.leave > 0) {
    return personDayStatusBadgeClass("leave");
  }
  if (day.missingPunch > 0) {
    return personDayStatusBadgeClass("onePunch");
  }
  if (day.absent > 0) {
    return personDayStatusBadgeClass("absent");
  }
  if (day.present > 0) {
    return personDayStatusBadgeClass("present");
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

function statusLabel(day: DaySummary): string {
  if (day.leave > 0) return personDayStatusLabel("leave", day.leaveLabel);
  if (day.missingPunch > 0) return personDayStatusLabel("onePunch");
  if (day.absent > 0) return ABSENT_STATUS;
  if (day.present > 0) return personDayStatusLabel("present");
  return "—";
}

function rowClassName(day: DaySummary): string {
  if (day.leave > 0) return "bg-teal-50/30 dark:bg-teal-950/10";
  if (day.missingPunch > 0) return "bg-orange-50/40 dark:bg-orange-950/10";
  if (day.absent > 0) return "bg-red-50/30 dark:bg-red-950/10";
  return "";
}

function buildDayMeta(day: DaySummary, index: number): DayTableMeta {
  return {
    index,
    shortDate: shortDate(day.date),
    weekday: weekdayLabel(day.date),
    statusLabel: statusLabel(day),
    statusBadgeClass: statusBadgeClass(day),
    rowClassName: rowClassName(day),
  };
}

function defaultStatusForDay(day: DaySummary): string {
  if (day.absent > 0) return ABSENT_STATUS;
  return HOLIDAY_LEAVE_TYPE;
}

type Props = {
  days: DaySummary[];
  person: AttendancePerson;
  shifts: AttendanceShift[];
  companyId: string;
  branchId: string;
  isSuperAdmin: boolean;
};

export function AttendancePersonMonthTable({
  days,
  person,
  shifts,
  companyId,
  branchId,
  isSuperAdmin,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <div
          className="min-w-[52rem] grid w-full text-right"
          style={PERSON_MONTH_GRID_STYLE}
        >
          <div className={PERSON_MONTH_SUBGRID_ROW_CLASS}>
            <div className={`${PERSON_MONTH_TH} justify-center flex`}>#</div>
            <div className={PERSON_MONTH_TH}>تاريخ</div>
            <div className={PERSON_MONTH_TH}>يوم</div>
            <div className={PERSON_MONTH_TH}>حالة</div>
            <div className={PERSON_MONTH_TH}>دخول</div>
            <div className={PERSON_MONTH_TH}>خروج</div>
            <div className={PERSON_MONTH_TH}>وردية</div>
            <div className={PERSON_MONTH_TH}>إجازة</div>
            <div className={PERSON_MONTH_TH}>ملاحظة</div>
            <div className={PERSON_MONTH_TH}>ت/خ</div>
            <div className={`${PERSON_MONTH_TH} sticky left-[2.25rem] z-20`}>حفظ</div>
            <div className={`${PERSON_MONTH_TH} sticky left-0 z-20`} />
          </div>

          {days.map((day, index) => {
            const record = day.records[0] ?? null;
            const dayMeta = buildDayMeta(day, index + 1);
            if (record) {
              return (
                <AttendanceRecordTableRow
                  key={`${record.id}:${record.is_absent}:${record.leave_type}:${record.first_check_in}:${record.last_check_out}:${record.late_minutes}:${record.deduction_minutes}:${record.notes}`}
                  record={record}
                  shifts={shifts}
                  isSuperAdmin={isSuperAdmin}
                  dayMeta={dayMeta}
                />
              );
            }
            return (
              <AttendanceCreateLeaveTableRow
                key={day.date}
                date={day.date}
                person={person}
                companyId={companyId}
                branchId={branchId}
                dayMeta={dayMeta}
                defaultStatus={defaultStatusForDay(day)}
              />
            );
          })}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-3">
        {days.map((day, index) => {
          const record = day.records[0] ?? null;
          const dayMeta = buildDayMeta(day, index + 1);
          if (record) {
            return (
              <AttendanceRecordMobileCard
                key={`mobile-${record.id}:${record.is_absent}:${record.leave_type}`}
                record={record}
                shifts={shifts}
                isSuperAdmin={isSuperAdmin}
                dayMeta={dayMeta}
              />
            );
          }
          return (
            <AttendanceCreateLeaveMobileCard
              key={`mobile-${day.date}`}
              date={day.date}
              person={person}
              companyId={companyId}
              branchId={branchId}
              dayMeta={dayMeta}
              defaultStatus={defaultStatusForDay(day)}
            />
          );
        })}
      </div>
    </div>
  );
}
