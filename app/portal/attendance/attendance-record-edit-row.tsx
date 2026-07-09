"use client";

import { useActionState } from "react";
import type { AttendanceMonthlyRecord, AttendancePerson, AttendanceShift } from "@/types/db";
import { hasOnePunch } from "@/lib/attendance/calendar-shared";
import {
  ABSENT_STATUS,
  CREATE_DAY_STATUS_OPTIONS,
  hasLeave,
  LEAVE_TYPES,
  recordLeaveLabel,
} from "@/lib/attendance/leave-types";
import {
  createLeaveRecordAction,
  deleteMonthlyRecordAction,
  updateMonthlyRecordAction,
  type ActionState,
} from "./actions";
import { DeleteConfirmButton } from "./delete-confirm-button";

type RawPunchTime = { date: string; time: string };

function parseAllPunchTimes(
  rawPayload: Record<string, unknown> | null | undefined,
): RawPunchTime[] {
  const payloadTimes = rawPayload?.all_punch_times;
  if (!Array.isArray(payloadTimes)) return [];

  const parsed: RawPunchTime[] = [];
  for (const punch of payloadTimes) {
    if (
      punch &&
      typeof punch === "object" &&
      "date" in punch &&
      "time" in punch &&
      typeof punch.date === "string" &&
      typeof punch.time === "string"
    ) {
      parsed.push({ date: punch.date, time: punch.time.slice(0, 5) });
    }
  }
  return parsed;
}

function selectedPunch(
  rawPayload: Record<string, unknown> | null | undefined,
  key: "selected_check_in" | "selected_check_out",
  fallbackDate: string,
  fallbackTime: string | null,
): RawPunchTime | null {
  const selected = rawPayload?.[key];
  if (
    selected &&
    typeof selected === "object" &&
    "date" in selected &&
    "time" in selected &&
    typeof selected.date === "string" &&
    typeof selected.time === "string"
  ) {
    return { date: selected.date, time: selected.time.slice(0, 5) };
  }
  if (fallbackTime) {
    return { date: fallbackDate, time: fallbackTime.slice(0, 5) };
  }
  return null;
}

function punchKey(punch: RawPunchTime): string {
  return `${punch.date}|${punch.time}`;
}

const timeInputProps = {
  type: "text" as const,
  inputMode: "numeric" as const,
  pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
  placeholder: "HH:MM",
  maxLength: 5,
  dir: "ltr" as const,
};

const compactInputClass =
  "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-900";
const compactSelectClass =
  "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-900";
const compactNotesClass =
  "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-900";
const compactCellClass = "px-2 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center";
const compactBadgeClass =
  "text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap";

export type DayTableMeta = {
  index: number;
  shortDate: string;
  weekday: string;
  statusLabel: string;
  statusBadgeClass: string;
  rowClassName: string;
};

type CreateLeaveFormProps = {
  date: string;
  person: AttendancePerson;
  companyId: string;
  branchId: string;
  compact?: boolean;
};

export function AttendanceCreateLeaveForm({
  date,
  person,
  companyId,
  branchId,
  compact = false,
}: CreateLeaveFormProps) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeaveRecordAction,
    undefined,
  );

  return (
    <form
      action={action}
      className={
        compact
          ? "flex flex-wrap items-center gap-2"
          : "px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-teal-50/60 dark:bg-teal-950/20 space-y-2"
      }
    >
      <input type="hidden" name="attendance_person_id" value={person.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />
      {!compact ? (
        <p className="text-sm font-semibold w-full">
          تسجيل عطلة / إجازة — {person.full_name}
        </p>
      ) : null}
      <select
        name="leave_type"
        required
        defaultValue="عطلة"
        className="px-2 py-1.5 border rounded-lg text-xs min-w-[140px]"
      >
        {CREATE_DAY_STATUS_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="text-xs px-3 py-1.5 bg-teal-600 text-white rounded-lg"
      >
        {pending ? "..." : "حفظ"}
      </button>
      {state?.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
      {state?.ok ? (
        <span className="text-xs text-teal-700">تم التسجيل</span>
      ) : null}
    </form>
  );
}

export function AttendanceCreateLeaveTableRow({
  date,
  person,
  companyId,
  branchId,
  dayMeta,
}: {
  date: string;
  person: AttendancePerson;
  companyId: string;
  branchId: string;
  dayMeta: DayTableMeta;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeaveRecordAction,
    undefined,
  );

  const cb = `${compactCellClass} ${dayMeta.rowClassName}`;

  return (
    <form action={action} className="contents">
      {/* hidden fields first — they don't affect grid layout */}
      <input type="hidden" name="attendance_person_id" value={person.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />

      {/* col 1: # */}
      <div className={`${cb} text-xs text-gray-500 justify-center`}>{dayMeta.index}</div>
      {/* col 2: date */}
      <div className={`${cb} text-xs font-medium`} dir="ltr">{dayMeta.shortDate}</div>
      {/* col 3: day */}
      <div className={`${cb} text-xs text-gray-500`}>{dayMeta.weekday}</div>
      {/* col 4: status */}
      <div className={cb}>
        <span className={`${compactBadgeClass} ${dayMeta.statusBadgeClass}`}>
          {dayMeta.statusLabel}
        </span>
      </div>
      {/* col 5: check-in — empty for new rows */}
      <div className={cb} />
      {/* col 6: check-out — empty for new rows */}
      <div className={cb} />
      {/* col 7: shift — empty for new rows */}
      <div className={cb} />
      {/* col 8: leave/status select */}
      <div className={cb}>
        <select
          name="leave_type"
          required
          defaultValue="عطلة"
          className={compactSelectClass}
        >
          {CREATE_DAY_STATUS_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      {/* col 9: notes — empty for new rows */}
      <div className={cb} />
      {/* col 10: late/deduction — empty for new rows */}
      <div className={cb} />
      {/* col 11: save button */}
      <div className={cb}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-2 py-1.5 bg-teal-600 text-white rounded whitespace-nowrap w-full"
        >
          {pending ? "..." : "حفظ"}
        </button>
        {state?.error ? (
          <p className="text-[10px] text-red-600 mt-0.5 leading-tight">{state.error}</p>
        ) : null}
      </div>
      {/* col 12: delete — empty for new rows */}
      <div className={cb} />
    </form>
  );
}

export function AttendanceRecordTableRow({
  record,
  shifts,
  isSuperAdmin,
  dayMeta,
}: {
  record: AttendanceMonthlyRecord;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  dayMeta: DayTableMeta;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateMonthlyRecordAction,
    undefined,
  );

  const lateDeduction =
    record.late_minutes > 0 || record.deduction_minutes > 0
      ? [
          record.late_minutes > 0 ? `ت${record.late_minutes}` : null,
          record.deduction_minutes > 0 ? `خ${record.deduction_minutes}` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "—";

  const cellBase = `${compactCellClass} ${dayMeta.rowClassName}`;
  const statusValue = record.is_absent
    ? ABSENT_STATUS
    : record.leave_type ?? "";

  return (
    <form action={action} className="contents">
      <div className={`${cellBase} text-xs text-gray-500 justify-center`}>
        <input type="hidden" name="id" value={record.id} />
        {dayMeta.index}
      </div>
      <div className={`${cellBase} text-xs font-medium`} dir="ltr">
        {dayMeta.shortDate}
      </div>
      <div className={`${cellBase} text-xs text-gray-500`}>
        {dayMeta.weekday}
      </div>
      <div className={cellBase}>
        <span className={`${compactBadgeClass} ${dayMeta.statusBadgeClass}`}>
          {dayMeta.statusLabel}
        </span>
      </div>
      <div className={cellBase}>
        <input
          name="first_check_in"
          {...timeInputProps}
          title="الدخول"
          defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
          className={compactInputClass}
        />
      </div>
      <div className={cellBase}>
        <input
          name="last_check_out"
          {...timeInputProps}
          title="الخروج"
          defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
          className={compactInputClass}
        />
      </div>
      <div className={cellBase}>
        {shifts.length > 0 ? (
          <select
            name="shift_id"
            title="الوردية"
            defaultValue={record.shift_id ?? ""}
            className={compactSelectClass}
            disabled={hasLeave(record)}
          >
            <option value="">—</option>
            {shifts
              .filter((s) => s.active)
              .map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
          </select>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>
      <div className={cellBase}>
        <select
          name="leave_type"
          title="حالة اليوم"
          defaultValue={statusValue}
          className={compactSelectClass}
        >
          <option value="">عادي</option>
          <option value={ABSENT_STATUS}>{ABSENT_STATUS}</option>
          {LEAVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className={cellBase}>
        <input
          name="notes"
          title="ملاحظة"
          defaultValue={record.notes ?? ""}
          placeholder="ملاحظة"
          className={compactNotesClass}
        />
      </div>
      <div className={`${cellBase} text-xs text-gray-500 whitespace-nowrap`} dir="ltr">
        {lateDeduction}
      </div>
      <div className={cellBase}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded whitespace-nowrap"
        >
          {pending ? "..." : "حفظ"}
        </button>
        {state?.error ? (
          <p className="text-xs text-red-600 mt-0.5 leading-tight">
            {state.error}
          </p>
        ) : null}
      </div>
      <div className={cellBase}>
        {isSuperAdmin ? (
          <DeleteConfirmButton
            label=""
            confirmMessage="حذف هذا السجل نهائياً؟"
            action={deleteMonthlyRecordAction}
            hiddenFields={{ id: record.id }}
            className="inline-flex p-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          />
        ) : null}
      </div>
    </form>
  );
}

type RecordEditRowProps = {
  record: AttendanceMonthlyRecord;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  showEmployeeHeader?: boolean;
  showPunchTimeline?: boolean;
};

export function AttendanceRecordEditRow({
  record,
  shifts,
  isSuperAdmin,
  showEmployeeHeader = true,
  showPunchTimeline = true,
}: RecordEditRowProps) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateMonthlyRecordAction,
    undefined,
  );
  const leaveLabel = recordLeaveLabel(record);

  return (
    <div className="space-y-2">
      {showEmployeeHeader ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{record.employee_name}</p>
            <p className="text-xs text-gray-500" dir="ltr">
              #{record.external_employee_number}
            </p>
          </div>
          <div className="text-xs text-gray-500 text-left">
            {leaveLabel ? (
              <p className="text-teal-700 font-semibold">{leaveLabel}</p>
            ) : (
              <p>{record.shift_type ?? (record.is_absent ? "غياب" : "—")}</p>
            )}
            {!record.is_absent && !hasLeave(record) && hasOnePunch(record) ? (
              <p className="text-orange-600 font-semibold">بصمة واحدة</p>
            ) : null}
            {!record.is_absent &&
            !hasLeave(record) &&
            record.punch_count &&
            record.punch_count > 1 ? (
              <p className="text-orange-600">{record.punch_count} بصمة</p>
            ) : null}
            {!record.is_absent && !hasLeave(record) && record.late_minutes > 0 ? (
              <p className="text-amber-600">تأخير {record.late_minutes} د</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={record.id} />
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">الدخول المحسوب</label>
          <input
            name="first_check_in"
            {...timeInputProps}
            defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
            className="w-24 px-2 py-1 border rounded-lg text-xs"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">الخروج المحسوب</label>
          <input
            name="last_check_out"
            {...timeInputProps}
            defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
            className="w-24 px-2 py-1 border rounded-lg text-xs"
          />
        </div>
        {shifts.length > 0 ? (
          <select
            name="shift_id"
            defaultValue={record.shift_id ?? ""}
            className="px-2 py-1 border rounded-lg text-xs"
            disabled={hasLeave(record)}
          >
            <option value="">بدون وردية</option>
            {shifts
              .filter((s) => s.active)
              .map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
          </select>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">حالة اليوم</label>
          <select
            name="leave_type"
            defaultValue={
              record.is_absent ? ABSENT_STATUS : record.leave_type ?? ""
            }
            className="px-2 py-1 border rounded-lg text-xs min-w-[120px]"
          >
            <option value="">دوام عادي</option>
            <option value={ABSENT_STATUS}>{ABSENT_STATUS}</option>
            {LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <input
          name="notes"
          defaultValue={record.notes ?? ""}
          placeholder="ملاحظة"
          className="flex-1 min-w-[100px] px-2 py-1 border rounded-lg text-xs"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1 bg-primary-600 text-white rounded-lg"
        >
          {pending ? "..." : "حفظ"}
        </button>
        {state?.error ? (
          <span className="text-xs text-red-600">{state.error}</span>
        ) : null}
      </form>
      {showPunchTimeline && !record.is_absent && !hasLeave(record) ? (
        <PunchTimeline record={record} />
      ) : null}
      {isSuperAdmin ? (
        <DeleteConfirmButton
          label="حذف السجل"
          confirmMessage="حذف هذا السجل نهائياً؟"
          action={deleteMonthlyRecordAction}
          hiddenFields={{ id: record.id }}
        />
      ) : null}
    </div>
  );
}

function PunchTimeline({ record }: { record: AttendanceMonthlyRecord }) {
  const rawPayload = record.raw_payload as Record<string, unknown> | null;
  const allPunches = parseAllPunchTimes(rawPayload);
  const firstPunchDate =
    (rawPayload?.first_punch_date as string | undefined) ?? record.date;
  const lastPunchDate =
    (rawPayload?.last_punch_date as string | undefined) ?? record.date;

  const selectedIn = selectedPunch(
    rawPayload,
    "selected_check_in",
    firstPunchDate,
    record.first_check_in,
  );
  const selectedOut = selectedPunch(
    rawPayload,
    "selected_check_out",
    lastPunchDate,
    record.last_check_out,
  );

  if (allPunches.length <= 1 && (record.punch_count ?? 0) <= 1) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 p-2">
      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        البصمات الخام ({allPunches.length || record.punch_count})
      </p>
      {allPunches.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {allPunches.map((punch) => {
            const key = punchKey(punch);
            const isCheckIn = selectedIn && punchKey(selectedIn) === key;
            const isCheckOut = selectedOut && punchKey(selectedOut) === key;
            const isIgnored = !isCheckIn && !isCheckOut;

            let className =
              "text-[10px] px-1.5 py-0.5 rounded border font-mono ";
            if (isCheckIn) {
              className +=
                "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200";
            } else if (isCheckOut) {
              className +=
                "bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200";
            } else if (isIgnored) {
              className +=
                "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200";
            } else {
              className += "bg-white border-gray-200 text-gray-700 dark:bg-gray-900";
            }

            return (
              <li key={key} className={className} dir="ltr">
                {punch.date} {punch.time}
                {isCheckIn ? " · دخول" : null}
                {isCheckOut ? " · خروج" : null}
                {isIgnored ? " · متجاهلة" : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[10px] text-gray-500">
          لا توجد بصمات خام محفوظة — أعد الاستيراد لعرض الجدول الزمني.
        </p>
      )}
      {rawPayload?.manually_overridden ? (
        <p className="text-[10px] text-violet-600 mt-1.5">تم تعديل الأوقات يدوياً</p>
      ) : null}
    </div>
  );
}
