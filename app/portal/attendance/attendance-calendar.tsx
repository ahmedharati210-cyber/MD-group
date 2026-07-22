"use client";

import { PortalLink } from "@/components/portal/PortalLink";
import { useSearchParams } from "next/navigation";
import { LinkPendingSpinner } from "@/components/portal/LinkPendingSpinner";
import type { DaySummary } from "@/lib/attendance/calendar-shared";
import { AR_WEEKDAY_LABELS } from "@/lib/attendance/calendar-shared";
import { ABSENT_STATUS } from "@/lib/attendance/leave-types";

function dayHasActivity(day: DaySummary): boolean {
  return (
    day.present > 0 ||
    day.absent > 0 ||
    day.late > 0 ||
    day.missingPunch > 0 ||
    day.leave > 0
  );
}

function isOffOnlyDay(day: DaySummary): boolean {
  return day.off > 0 && !dayHasActivity(day);
}

function dayAriaLabel(day: DaySummary, dayNum: number, personMode: boolean): string {
  const parts = [`يوم ${dayNum}`];
  if (personMode) {
    if (day.leave > 0) parts.push(day.leaveLabel ?? "إجازة");
    else if (day.missingPunch > 0) parts.push("بصمة واحدة");
    else if (day.absent > 0) parts.push(ABSENT_STATUS);
    else if (day.present > 0) parts.push("حاضر");
    else if (day.off > 0) parts.push("راحة");
  } else {
    if (day.leave > 0) parts.push(`${day.leave} إجازة`);
    if (day.present > 0) parts.push(`${day.present} حضور`);
    if (day.absent > 0) parts.push(`${day.absent} غياب`);
    if (day.missingPunch > 0) parts.push(`${day.missingPunch} بصمة ناقصة`);
    if (isOffOnlyDay(day)) parts.push("راحة");
    else if (day.off > 0) parts.push(`${day.off} راحة`);
  }
  if (day.late > 0) parts.push(personMode ? "تأخير" : `${day.late} تأخير`);
  return parts.join("، ");
}

function dayCellClass(day: DaySummary, isSelected: boolean): string {
  const hasLeave = day.leave > 0;
  const hasMissingPunch = day.missingPunch > 0;
  const hasAbsent = day.absent > 0;
  const hasData = dayHasActivity(day);

  if (isSelected) {
    return "border-primary-500 bg-primary-50 dark:bg-primary-900/20";
  }
  if (hasLeave) {
    return "border-teal-200 bg-teal-50 text-teal-900 hover:border-teal-300 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-100";
  }
  if (hasMissingPunch) {
    return "border-orange-200 bg-orange-50 text-orange-900 hover:border-orange-300 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-100";
  }
  if (hasAbsent) {
    return "border-red-200 bg-red-50 text-red-900 hover:border-red-300 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100";
  }
  if (isOffOnlyDay(day)) {
    return "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200";
  }
  if (hasData) {
    return "border-gray-200 dark:border-gray-700 hover:border-primary-300";
  }
  return "border-gray-100 dark:border-gray-800 text-gray-400";
}

type Props = {
  days: DaySummary[];
  month: string;
  selectedDay: string | null;
  /** When true, each day has at most one record (a single selected person). */
  personMode?: boolean;
  title?: string;
};

export function AttendanceCalendar({
  days,
  month,
  selectedDay,
  personMode = false,
  title = "تقويم الشهر",
}: Props) {
  const searchParams = useSearchParams();
  const [year, monthNum] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthNum - 1, 1).getDay();
  const blanks = Array.from({ length: firstWeekday });

  function dayHref(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedDay === date) {
      params.delete("day");
    } else {
      params.set("day", date);
    }
    return `/portal/attendance?${params.toString()}`;
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
      <h2 className="text-base font-bold mb-3">{title}</h2>
      {!personMode ? (
        <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500 mb-3">
          <span><span className="text-emerald-600 font-semibold">ح</span> حضور</span>
          <span><span className="text-red-600 font-semibold">غ</span> غياب</span>
          <span><span className="text-teal-600 font-semibold">إ</span> إجازة</span>
          <span><span className="text-amber-600 font-semibold">ت</span> تأخير</span>
          <span><span className="text-orange-600 font-semibold">بصمة</span> بصمة ناقصة</span>
          <span><span className="text-slate-600 font-semibold">ر</span> راحة</span>
        </div>
      ) : null}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
        {AR_WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1 font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[56px] md:min-h-[72px]" />
        ))}
        {days.map((day) => {
          const dayNum = Number(day.date.slice(8, 10));
          const isSelected = selectedDay === day.date;
          const hasData = dayHasActivity(day);
          return (
            <PortalLink
              key={day.date}
              href={dayHref(day.date)}
              aria-label={dayAriaLabel(day, dayNum, personMode)}
              aria-current={isSelected ? "date" : undefined}
              className={`relative min-h-[56px] md:min-h-[72px] rounded-xl border p-1.5 text-right transition-colors ${dayCellClass(day, isSelected)}`}
            >
              <LinkPendingSpinner className="absolute top-1 left-1 z-10" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {dayNum}
              </span>
              {personMode ? (
                <span
                  className={`mt-1 block text-[9px] sm:text-[10px] font-semibold ${
                    day.leave > 0
                      ? "text-teal-700 dark:text-teal-300"
                      : day.missingPunch > 0
                      ? "text-orange-700 dark:text-orange-300"
                      : day.absent > 0
                        ? "text-red-700 dark:text-red-300"
                        : day.present > 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : day.off > 0
                            ? "text-slate-600 dark:text-slate-300"
                            : "text-gray-400"
                  }`}
                >
                  {day.leave > 0
                    ? day.leaveLabel ?? "إجازة"
                    : day.missingPunch > 0
                    ? "بصمة واحدة"
                    : day.absent > 0
                      ? ABSENT_STATUS
                      : day.present > 0
                        ? "حاضر"
                        : day.off > 0
                          ? "راحة"
                          : ""}
                  {day.late > 0 ? " · تأخير" : ""}
                </span>
              ) : hasData ? (
                <div className="mt-1 space-y-0.5 text-[9px] sm:text-[10px] leading-tight">
                  {day.leave > 0 ? (
                    <span className="block text-teal-600">
                      <span className="sm:hidden">إ{day.leave}</span>
                      <span className="hidden sm:inline">إ {day.leave}</span>
                    </span>
                  ) : null}
                  {day.present > 0 ? (
                    <span className="block text-emerald-600">
                      <span className="sm:hidden">ح{day.present}</span>
                      <span className="hidden sm:inline">ح {day.present}</span>
                    </span>
                  ) : null}
                  {day.absent > 0 ? (
                    <span className="block text-red-600">
                      <span className="sm:hidden">غ{day.absent}</span>
                      <span className="hidden sm:inline">غ {day.absent}</span>
                    </span>
                  ) : null}
                  {day.late > 0 ? (
                    <span className="hidden sm:block text-amber-600">ت {day.late}</span>
                  ) : null}
                  {day.missingPunch > 0 ? (
                    <span className="hidden sm:block text-orange-600">بصمة {day.missingPunch}</span>
                  ) : null}
                  {day.off > 0 ? (
                    <span className="block text-slate-500">
                      <span className="sm:hidden">ر{day.off}</span>
                      <span className="hidden sm:inline">ر {day.off}</span>
                    </span>
                  ) : null}
                </div>
              ) : day.off > 0 ? (
                <span className="mt-1 block text-[9px] sm:text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  راحة
                </span>
              ) : null}
            </PortalLink>
          );
        })}
      </div>
    </div>
  );
}
