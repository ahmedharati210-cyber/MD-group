"use client";

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import toast from "react-hot-toast";
import type { AttendanceMonthlyRecord, AttendancePerson, AttendanceShift } from "@/types/db";
import { hasOnePunch } from "@/lib/attendance/calendar-shared";
import {
  ABSENT_STATUS,
  hasLeave,
  HOLIDAY_LEAVE_TYPE,
  isLeaveType,
  recordLeaveLabel,
} from "@/lib/attendance/leave-types";
import { readManagementPasses } from "@/lib/attendance/management-passes";
import {
  createLeaveRecordAction,
  deleteMonthlyRecordAction,
  updateMonthlyRecordAction,
  type ActionState,
} from "./actions";
import { DeleteConfirmButton } from "./delete-confirm-button";
import {
  DayStatusSelectWithWarning,
  LeaveTypeSelectWithWarning,
} from "./leave-type-select-with-warning";
import { restoreScrollY, withPreservedScroll } from "./preserve-scroll";

function useSaveSuccessToast(state: ActionState | undefined) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    if (!state?.ok) return;
    toast.success("تم الحفظ");
    if (state.warning) toast(state.warning, { icon: "⚠️" });
    restoreScrollY();
  }, [state]);
}

function ManagementPassToggles({
  record,
  hidden,
  compact = false,
}: {
  record: AttendanceMonthlyRecord;
  hidden: boolean;
  compact?: boolean;
}) {
  if (hidden) return null;
  const passes = readManagementPasses(record.raw_payload);

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-1 text-[10px] leading-tight"
          : "flex flex-wrap gap-x-3 gap-y-1 text-xs"
      }
    >
      <label className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          name="waive_late"
          value="true"
          defaultChecked={passes.waiveLate}
          className="rounded"
        />
        سماح تأخير
      </label>
      <label className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          name="waive_early_leave"
          value="true"
          defaultChecked={passes.waiveEarlyLeave}
          className="rounded"
        />
        سماح خروج مبكر
      </label>
    </div>
  );
}

function ManagementPassBadges({
  record,
}: {
  record: AttendanceMonthlyRecord;
}) {
  if (record.is_absent || hasLeave(record)) return null;
  const passes = readManagementPasses(record.raw_payload);
  if (!passes.waiveLate && !passes.waiveEarlyLeave) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {passes.waiveLate ? (
        <span className="inline-flex px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-semibold">
          سماح تأخير
        </span>
      ) : null}
      {passes.waiveEarlyLeave ? (
        <span className="inline-flex px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-semibold">
          سماح خروج
        </span>
      ) : null}
    </div>
  );
}

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

/** Shared column template for person month table rows. */
export const PERSON_MONTH_GRID_COLUMNS =
  "2.25rem 3.75rem 3.5rem minmax(5.5rem,1fr) 5rem 5rem minmax(5rem,1fr) minmax(6rem,1fr) minmax(6rem,1.5fr) 4rem 3.5rem 2.25rem";

export const PERSON_MONTH_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: PERSON_MONTH_GRID_COLUMNS,
};

export const PERSON_MONTH_SUBGRID_ROW_CLASS =
  "col-span-full grid grid-cols-subgrid w-full";

export const PERSON_MONTH_TH =
  "sticky top-0 z-10 px-2 py-2 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-500 border-b border-gray-200 dark:border-gray-700";

/** Shared column template for day-panel record rows. */
export const DAY_PANEL_GRID_COLUMNS =
  "4.5rem 4.5rem 5.5rem 6.5rem minmax(8rem,1fr) 3.75rem";

export const DAY_PANEL_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: DAY_PANEL_GRID_COLUMNS,
};

export const dayPanelFormGridClass =
  "grid w-full grid-cols-[4.5rem_4.5rem_5.5rem_6.5rem_minmax(8rem,1fr)_3.75rem] gap-2 items-center";

export const DAY_PANEL_SUBGRID_ROW_CLASS =
  "col-span-full grid grid-cols-subgrid gap-2 items-center w-full";

const dayPanelControlClass =
  "h-8 w-full min-w-0 px-2 border border-gray-200 dark:border-gray-700 rounded-md text-xs bg-white dark:bg-gray-900";

const dayPanelEmptyClass =
  "h-8 w-full flex items-center justify-center rounded-md border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 text-xs text-gray-400";

const dayPanelSaveClass =
  "h-8 w-full px-2 rounded-md text-xs font-semibold whitespace-nowrap bg-primary-600 text-white border border-primary-600 hover:bg-primary-700 disabled:opacity-60";

function DayPanelCell({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function RecordDayMeta({ record }: { record: AttendanceMonthlyRecord }) {
  const leaveLabel = recordLeaveLabel(record);

  return (
    <div className="text-xs text-gray-500 text-left shrink-0 space-y-0.5">
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
      {!record.is_absent &&
      !hasLeave(record) &&
      record.early_leave_minutes > 0 ? (
        <p className="text-amber-600">خروج مبكر {record.early_leave_minutes} د</p>
      ) : null}
      <ManagementPassBadges record={record} />
    </div>
  );
}

function recordDayStatus(record: AttendanceMonthlyRecord): string {
  if (record.is_absent) return ABSENT_STATUS;
  if (record.leave_type) return record.leave_type;
  if (record.is_holiday) return HOLIDAY_LEAVE_TYPE;
  return "";
}

function hidesAttendanceTimes(status: string): boolean {
  return status === ABSENT_STATUS || isLeaveType(status);
}

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
  defaultStatus?: string;
};

export function AttendanceCreateLeaveForm({
  date,
  person,
  companyId,
  branchId,
  compact = false,
  defaultStatus = HOLIDAY_LEAVE_TYPE,
}: CreateLeaveFormProps) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeaveRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);

  const statusSelect = (
    <LeaveTypeSelectWithWarning
      defaultValue={defaultStatus}
      className={dayPanelControlClass}
      annualRemaining={person.annual_leave_remaining}
      sickRemaining={person.sick_leave_remaining}
    />
  );

  return (
    <form action={withPreservedScroll(action)} className={compact ? "md:contents" : undefined}>
      <input type="hidden" name="attendance_person_id" value={person.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />
      {!compact ? (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-teal-50/60 dark:bg-teal-950/20 space-y-2">
          <p className="text-sm font-semibold w-full">
            تسجيل عطلة / إجازة — {person.full_name}
          </p>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">حالة اليوم</label>
            {statusSelect}
          </div>
          <button type="submit" disabled={pending} className={dayPanelSaveClass}>
            {pending ? "..." : "حفظ"}
          </button>
          {state?.error ? (
            <p className="text-xs text-red-600">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="text-xs text-teal-700">تم التسجيل</p>
          ) : null}
        </div>
      ) : (
        <>
          <div
          className={`hidden md:grid ${DAY_PANEL_SUBGRID_ROW_CLASS} md:px-4 md:pb-3 md:border-b md:border-gray-100 dark:md:border-gray-800`}
        >
            <DayPanelCell>
              <div className={dayPanelEmptyClass} aria-hidden>
                —
              </div>
            </DayPanelCell>
            <DayPanelCell>
              <div className={dayPanelEmptyClass} aria-hidden>
                —
              </div>
            </DayPanelCell>
            <DayPanelCell>
              <div className={dayPanelEmptyClass} aria-hidden>
                —
              </div>
            </DayPanelCell>
            <DayPanelCell>{statusSelect}</DayPanelCell>
            <DayPanelCell>
              <div className={dayPanelEmptyClass} aria-hidden>
                —
              </div>
            </DayPanelCell>
            <DayPanelCell>
              <button type="submit" disabled={pending} className={dayPanelSaveClass}>
                {pending ? "..." : "حفظ"}
              </button>
            </DayPanelCell>
          </div>
          <div className="md:hidden space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">حالة اليوم</label>
              {statusSelect}
            </div>
            <button type="submit" disabled={pending} className={dayPanelSaveClass}>
              {pending ? "..." : "حفظ"}
            </button>
          </div>
          {state?.error ? (
            <p className="text-xs text-red-600 mt-1 md:col-span-full md:px-4 md:mt-0 md:pb-2">
              {state.error}
            </p>
          ) : null}
          {state?.ok ? (
            <p className="text-xs text-teal-700 mt-1 md:col-span-full md:px-4 md:mt-0 md:pb-2">
              تم التسجيل
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}

export function AttendanceCreateLeaveTableRow({
  date,
  person,
  companyId,
  branchId,
  dayMeta,
  defaultStatus = HOLIDAY_LEAVE_TYPE,
}: {
  date: string;
  person: AttendancePerson;
  companyId: string;
  branchId: string;
  dayMeta: DayTableMeta;
  defaultStatus?: string;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeaveRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);

  const cb = `${compactCellClass} ${dayMeta.rowClassName}`;
  const stickySave = `${cb} sticky left-[2.25rem] z-[5] bg-inherit`;

  return (
    <form action={withPreservedScroll(action)} className={PERSON_MONTH_SUBGRID_ROW_CLASS}>
      <input type="hidden" name="attendance_person_id" value={person.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />

      <div className={`${cb} text-xs text-gray-500 justify-center`}>{dayMeta.index}</div>
      <div className={`${cb} text-xs font-medium`} dir="ltr">{dayMeta.shortDate}</div>
      <div className={`${cb} text-xs text-gray-500`}>{dayMeta.weekday}</div>
      <div className={cb}>
        <span className={`${compactBadgeClass} ${dayMeta.statusBadgeClass}`}>
          {dayMeta.statusLabel}
        </span>
      </div>
      <div className={cb} />
      <div className={cb} />
      <div className={cb} />
      <div className={cb}>
        <LeaveTypeSelectWithWarning
          defaultValue={defaultStatus}
          className={compactSelectClass}
          annualRemaining={person.annual_leave_remaining}
          sickRemaining={person.sick_leave_remaining}
        />
      </div>
      <div className={cb} />
      <div className={cb} />
      <div className={stickySave}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-2 py-1.5 bg-teal-600 text-white rounded whitespace-nowrap w-full"
        >
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
        {state?.error ? (
          <p className="text-[10px] text-red-600 mt-0.5 leading-tight">{state.error}</p>
        ) : null}
      </div>
      <div className={`${cb} sticky left-0 z-[5] bg-inherit`} />
    </form>
  );
}

export function AttendanceRecordTableRow({
  record,
  person,
  shifts,
  isSuperAdmin,
  dayMeta,
}: {
  record: AttendanceMonthlyRecord;
  person: AttendancePerson | null;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  dayMeta: DayTableMeta;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateMonthlyRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);
  const [dayStatus, setDayStatus] = useState(() => recordDayStatus(record));
  const hideTimes = hidesAttendanceTimes(dayStatus);

  const lateDeduction =
    record.late_minutes > 0 || record.early_leave_minutes > 0
      ? [
          record.late_minutes > 0 ? `ت${record.late_minutes}` : null,
          record.early_leave_minutes > 0
            ? `م${record.early_leave_minutes}`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "—";

  const cellBase = `${compactCellClass} ${dayMeta.rowClassName}`;
  const stickySave = `${cellBase} sticky left-[2.25rem] z-[5] bg-inherit`;
  const stickyDelete = `${cellBase} sticky left-0 z-[5] bg-inherit`;

  return (
    <form action={withPreservedScroll(action)} className={PERSON_MONTH_SUBGRID_ROW_CLASS}>
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
        {hideTimes ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <input
            name="first_check_in"
            {...timeInputProps}
            title="الدخول"
            defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
            className={compactInputClass}
          />
        )}
      </div>
      <div className={cellBase}>
        {hideTimes ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <input
            name="last_check_out"
            {...timeInputProps}
            title="الخروج"
            defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
            className={compactInputClass}
          />
        )}
      </div>
      <div className={cellBase}>
        {hideTimes ? (
          <span className="text-xs text-gray-400">—</span>
        ) : shifts.length > 0 ? (
          <select
            name="shift_id"
            title="الوردية"
            defaultValue={record.shift_id ?? ""}
            className={compactSelectClass}
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
        <div className="w-full space-y-1.5">
          <DayStatusSelectWithWarning
            title="حالة اليوم"
            value={dayStatus}
            onChange={setDayStatus}
            className={compactSelectClass}
            annualRemaining={person?.annual_leave_remaining}
            sickRemaining={person?.sick_leave_remaining}
          />
          <ManagementPassToggles record={record} hidden={hideTimes} compact />
        </div>
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
        <div className="space-y-0.5">
          <div>{lateDeduction}</div>
          <ManagementPassBadges record={record} />
        </div>
      </div>
      <div className={stickySave}>
        <button
          type="submit"
          disabled={pending}
          className="text-xs px-3 py-1.5 bg-primary-600 text-white rounded whitespace-nowrap w-full"
        >
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
        {state?.error ? (
          <p className="text-xs text-red-600 mt-0.5 leading-tight">
            {state.error}
          </p>
        ) : null}
      </div>
      <div className={stickyDelete}>
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

const mobileCardClass =
  "rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3";

export function AttendanceCreateLeaveMobileCard({
  date,
  person,
  companyId,
  branchId,
  dayMeta,
  defaultStatus = HOLIDAY_LEAVE_TYPE,
}: {
  date: string;
  person: AttendancePerson;
  companyId: string;
  branchId: string;
  dayMeta: DayTableMeta;
  defaultStatus?: string;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    createLeaveRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);

  return (
    <form
      action={withPreservedScroll(action)}
      className={`${mobileCardClass} ${dayMeta.rowClassName}`}
    >
      <input type="hidden" name="attendance_person_id" value={person.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" dir="ltr">
            {dayMeta.shortDate}
          </p>
          <p className="text-xs text-gray-500">{dayMeta.weekday}</p>
        </div>
        <span className={`${compactBadgeClass} ${dayMeta.statusBadgeClass}`}>
          {dayMeta.statusLabel}
        </span>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-gray-500">حالة اليوم</label>
        <LeaveTypeSelectWithWarning
          defaultValue={defaultStatus}
          className={compactSelectClass}
          annualRemaining={person.annual_leave_remaining}
          sickRemaining={person.sick_leave_remaining}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full text-sm px-3 py-2 bg-teal-600 text-white rounded-lg font-semibold"
      >
        {pending ? "جاري الحفظ..." : "حفظ"}
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}

export function AttendanceRecordMobileCard({
  record,
  person,
  shifts,
  isSuperAdmin,
  dayMeta,
}: {
  record: AttendanceMonthlyRecord;
  person: AttendancePerson | null;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  dayMeta: DayTableMeta;
}) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateMonthlyRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);
  const [dayStatus, setDayStatus] = useState(() => recordDayStatus(record));
  const hideTimes = hidesAttendanceTimes(dayStatus);

  const lateDeduction =
    record.late_minutes > 0 || record.early_leave_minutes > 0
      ? [
          record.late_minutes > 0 ? `تأخير ${record.late_minutes} د` : null,
          record.early_leave_minutes > 0
            ? `خروج مبكر ${record.early_leave_minutes} د`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <form
      action={withPreservedScroll(action)}
      className={`${mobileCardClass} ${dayMeta.rowClassName}`}
    >
      <input type="hidden" name="id" value={record.id} />
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" dir="ltr">
            {dayMeta.shortDate}
          </p>
          <p className="text-xs text-gray-500">{dayMeta.weekday}</p>
        </div>
        <span className={`${compactBadgeClass} ${dayMeta.statusBadgeClass}`}>
          {dayMeta.statusLabel}
        </span>
      </div>
      {!hideTimes ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">دخول</label>
            <input
              name="first_check_in"
              {...timeInputProps}
              defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
              className={compactInputClass}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">خروج</label>
            <input
              name="last_check_out"
              {...timeInputProps}
              defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
              className={compactInputClass}
            />
          </div>
        </div>
      ) : null}
      {!hideTimes && shifts.length > 0 ? (
        <div className="space-y-1">
          <label className="text-xs text-gray-500">وردية</label>
          <select
            name="shift_id"
            defaultValue={record.shift_id ?? ""}
            className={compactSelectClass}
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
        </div>
      ) : null}
      <div className="space-y-1">
        <label className="text-xs text-gray-500">حالة اليوم</label>
        <DayStatusSelectWithWarning
          value={dayStatus}
          onChange={setDayStatus}
          className={compactSelectClass}
          annualRemaining={person?.annual_leave_remaining}
          sickRemaining={person?.sick_leave_remaining}
        />
      </div>
      <ManagementPassToggles record={record} hidden={hideTimes} />
      <div className="space-y-1">
        <label className="text-xs text-gray-500">ملاحظة</label>
        <input
          name="notes"
          defaultValue={record.notes ?? ""}
          placeholder="ملاحظة"
          className={compactNotesClass}
        />
      </div>
      {lateDeduction ? (
        <p className="text-xs text-gray-500">{lateDeduction}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 text-sm px-3 py-2 bg-primary-600 text-white rounded-lg font-semibold"
        >
          {pending ? "جاري الحفظ..." : "حفظ"}
        </button>
        {isSuperAdmin ? (
          <DeleteConfirmButton
            label="حذف"
            confirmMessage="حذف هذا السجل نهائياً؟"
            action={deleteMonthlyRecordAction}
            hiddenFields={{ id: record.id }}
            className="px-3 py-2 text-sm text-red-600 border border-red-200 dark:border-red-900 rounded-lg"
          />
        ) : null}
      </div>
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}

type RecordEditRowProps = {
  record: AttendanceMonthlyRecord;
  person?: AttendancePerson | null;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
  showEmployeeHeader?: boolean;
  showPunchTimeline?: boolean;
  employeeName?: string;
  externalNumber?: string;
};

export function AttendanceRecordEditRow({
  record,
  person = null,
  shifts,
  isSuperAdmin,
  showEmployeeHeader = true,
  showPunchTimeline = true,
  employeeName,
  externalNumber,
}: RecordEditRowProps) {
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateMonthlyRecordAction,
    undefined,
  );
  useSaveSuccessToast(state);
  const [dayStatus, setDayStatus] = useState(() => recordDayStatus(record));
  const hideTimes = hidesAttendanceTimes(dayStatus);
  const displayName = employeeName ?? record.employee_name;
  const displayNumber = externalNumber ?? record.external_employee_number;

  return (
    <div className="space-y-2 md:contents">
      {showEmployeeHeader ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center min-h-8 md:col-span-full md:px-4 md:pt-3 md:pb-1">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{displayName}</p>
            <p className="text-[11px] text-gray-500 leading-tight" dir="ltr">
              #{displayNumber}
            </p>
          </div>
          <RecordDayMeta record={record} />
          {isSuperAdmin ? (
            <DeleteConfirmButton
              label="حذف"
              confirmMessage="حذف هذا السجل نهائياً؟"
              action={deleteMonthlyRecordAction}
              hiddenFields={{ id: record.id }}
              className="h-8 px-2.5 text-[11px] text-red-600 border border-red-200 dark:border-red-900 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
            />
          ) : null}
        </div>
      ) : null}
      <form action={withPreservedScroll(action)} className="md:contents">
        <input type="hidden" name="id" value={record.id} />
        <div
          className={`hidden md:grid ${DAY_PANEL_SUBGRID_ROW_CLASS} md:px-4 md:pb-3 md:border-b md:border-gray-100 dark:md:border-gray-800`}
        >
          <DayPanelCell>
            {hideTimes ? (
              <div className={dayPanelEmptyClass}>—</div>
            ) : (
              <input
                name="first_check_in"
                {...timeInputProps}
                defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
                className={dayPanelControlClass}
              />
            )}
          </DayPanelCell>
          <DayPanelCell>
            {hideTimes ? (
              <div className={dayPanelEmptyClass}>—</div>
            ) : (
              <input
                name="last_check_out"
                {...timeInputProps}
                defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
                className={dayPanelControlClass}
              />
            )}
          </DayPanelCell>
          <DayPanelCell>
            {hideTimes ? (
              <div className={dayPanelEmptyClass}>—</div>
            ) : shifts.length > 0 ? (
              <select
                name="shift_id"
                defaultValue={record.shift_id ?? ""}
                className={dayPanelControlClass}
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
              <div className={dayPanelEmptyClass}>—</div>
            )}
          </DayPanelCell>
          <DayPanelCell>
            <div className="space-y-1">
              <DayStatusSelectWithWarning
                value={dayStatus}
                onChange={setDayStatus}
                className={dayPanelControlClass}
                annualRemaining={person?.annual_leave_remaining}
                sickRemaining={person?.sick_leave_remaining}
              />
              <ManagementPassToggles record={record} hidden={hideTimes} compact />
            </div>
          </DayPanelCell>
          <DayPanelCell>
            <input
              name="notes"
              defaultValue={record.notes ?? ""}
              placeholder="ملاحظة"
              className={dayPanelControlClass}
            />
          </DayPanelCell>
          <DayPanelCell>
            <button type="submit" disabled={pending} className={dayPanelSaveClass}>
              {pending ? "…" : "حفظ"}
            </button>
          </DayPanelCell>
        </div>
        <div className="md:hidden space-y-2">
          {!hideTimes ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">الدخول</label>
                <input
                  name="first_check_in"
                  {...timeInputProps}
                  defaultValue={record.first_check_in?.slice(0, 5) ?? ""}
                  className={dayPanelControlClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">الخروج</label>
                <input
                  name="last_check_out"
                  {...timeInputProps}
                  defaultValue={record.last_check_out?.slice(0, 5) ?? ""}
                  className={dayPanelControlClass}
                />
              </div>
            </div>
          ) : null}
          {!hideTimes && shifts.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs text-gray-500">الوردية</label>
              <select
                name="shift_id"
                defaultValue={record.shift_id ?? ""}
                className={dayPanelControlClass}
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
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">حالة اليوم</label>
            <DayStatusSelectWithWarning
              value={dayStatus}
              onChange={setDayStatus}
              className={dayPanelControlClass}
              annualRemaining={person?.annual_leave_remaining}
              sickRemaining={person?.sick_leave_remaining}
            />
          </div>
          <ManagementPassToggles record={record} hidden={hideTimes} />
          <div className="space-y-1">
            <label className="text-xs text-gray-500">ملاحظة</label>
            <input
              name="notes"
              defaultValue={record.notes ?? ""}
              placeholder="ملاحظة"
              className={dayPanelControlClass}
            />
          </div>
          <button type="submit" disabled={pending} className={dayPanelSaveClass}>
            {pending ? "…" : "حفظ"}
          </button>
        </div>
        {state?.error ? (
          <p className="text-xs text-red-600 mt-1 md:col-span-full md:px-4 md:mt-0 md:pb-2">
            {state.error}
          </p>
        ) : null}
      </form>
      {showPunchTimeline && !hideTimes ? (
        <div className="md:col-span-full md:px-4 md:pb-3">
          <PunchTimeline record={record} />
        </div>
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
    <div className="rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 px-2 py-1.5">
      <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
        البصمات الخام ({allPunches.length || record.punch_count})
      </p>
      {allPunches.length > 0 ? (
        <ul className="flex flex-wrap gap-1 min-h-6 items-center">
          {allPunches.map((punch) => {
            const key = punchKey(punch);
            const isCheckIn = selectedIn && punchKey(selectedIn) === key;
            const isCheckOut = selectedOut && punchKey(selectedOut) === key;
            const isIgnored = !isCheckIn && !isCheckOut;

            let className =
              "inline-flex items-center h-6 text-[10px] px-1.5 rounded border font-mono ";
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
