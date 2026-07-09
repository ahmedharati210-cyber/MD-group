"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DaySummary } from "@/lib/attendance/calendar-shared";

const AR_DAYS = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function dayCellClass(day: DaySummary, isSelected: boolean): string {
  const hasLeave = day.leave > 0;
  const hasMissingPunch = day.missingPunch > 0;
  const hasAbsent = day.absent > 0;
  const hasData =
    day.present > 0 ||
    day.absent > 0 ||
    day.late > 0 ||
    day.missingPunch > 0 ||
    day.leave > 0;

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
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
        {AR_DAYS.map((d) => (
          <div key={d} className="py-1 font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[72px]" />
        ))}
        {days.map((day) => {
          const dayNum = Number(day.date.slice(8, 10));
          const isSelected = selectedDay === day.date;
          const hasData =
            day.present > 0 ||
            day.absent > 0 ||
            day.late > 0 ||
            day.missingPunch > 0 ||
            day.leave > 0;
          return (
            <Link
              key={day.date}
              href={dayHref(day.date)}
              className={`min-h-[72px] rounded-xl border p-1.5 text-right transition-colors ${dayCellClass(day, isSelected)}`}
            >
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {dayNum}
              </span>
              {personMode ? (
                <span
                  className={`mt-1 block text-[10px] font-semibold ${
                    day.leave > 0
                      ? "text-teal-700 dark:text-teal-300"
                      : day.missingPunch > 0
                      ? "text-orange-700 dark:text-orange-300"
                      : day.absent > 0
                        ? "text-red-700 dark:text-red-300"
                        : day.present > 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-gray-400"
                  }`}
                >
                  {day.leave > 0
                    ? day.leaveLabel ?? "إجازة"
                    : day.missingPunch > 0
                    ? "بصمة واحدة"
                    : day.absent > 0
                      ? "لم يظهر"
                      : day.present > 0
                        ? "حاضر"
                        : ""}
                  {day.late > 0 ? " · تأخير" : ""}
                </span>
              ) : hasData ? (
                <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
                  {day.leave > 0 ? (
                    <span className="block text-teal-600">إ {day.leave}</span>
                  ) : null}
                  {day.present > 0 ? (
                    <span className="block text-emerald-600">ح {day.present}</span>
                  ) : null}
                  {day.absent > 0 ? (
                    <span className="block text-red-600">غ {day.absent}</span>
                  ) : null}
                  {day.late > 0 ? (
                    <span className="block text-amber-600">ت {day.late}</span>
                  ) : null}
                  {day.missingPunch > 0 ? (
                    <span className="block text-orange-600">بصمة {day.missingPunch}</span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
