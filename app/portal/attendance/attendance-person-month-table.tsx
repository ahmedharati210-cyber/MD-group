"use client";

import React from "react";
import type { DaySummary } from "@/lib/attendance/calendar-shared";
import { ABSENT_STATUS } from "@/lib/attendance/leave-types";
import type { AttendancePerson, AttendanceShift } from "@/types/db";
import {
  personDayStatusBadgeClass,
  personDayStatusLabel,
} from "@/lib/attendance/status-labels";
import {
  AttendanceCreateLeaveTableRow,
  AttendanceRecordTableRow,
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

type Props = {
  days: DaySummary[];
  person: AttendancePerson;
  shifts: AttendanceShift[];
  companyId: string;
  branchId: string;
  isSuperAdmin: boolean;
};

/**
 * 12 columns: # | date | day | status | check-in | check-out | shift | leave | notes | late | save | delete
 * Using inline style because the arbitrary Tailwind grid-cols value is too long for reliable JIT compilation.
 */
const GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns:
    "2.25rem 3.75rem 2.75rem minmax(5.5rem,1fr) 5rem 5rem minmax(5rem,1fr) minmax(6rem,1fr) minmax(6rem,1.5fr) 4rem 3.5rem 2.25rem",
};

const TH =
  "sticky top-0 z-10 px-2 py-2 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-500 border-b border-gray-200 dark:border-gray-700";

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
      <div className="overflow-x-auto">
        {/*
          CSS Grid replaces <table> so that <form className="contents"> is valid HTML.
          A <form> cannot be a child of <tr> in HTML, but it is fine as a grid child.
        */}
        <div className="grid w-full text-right" style={GRID_STYLE}>
          {/* Sticky header row — each cell is individually sticky */}
          <div className={`${TH} justify-center flex`}>#</div>
          <div className={TH}>تاريخ</div>
          <div className={TH}>يوم</div>
          <div className={TH}>حالة</div>
          <div className={TH}>دخول</div>
          <div className={TH}>خروج</div>
          <div className={TH}>وردية</div>
          <div className={TH}>إجازة</div>
          <div className={TH}>ملاحظة</div>
          <div className={TH}>ت/خ</div>
          <div className={TH}>حفظ</div>
          <div className={TH} />

          {/* Data rows — each row is a <form className="contents"> */}
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
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
