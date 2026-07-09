"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceShift } from "@/types/db";
import {
  createAttendanceShiftAction,
  deleteAttendanceShiftAction,
  toggleAttendanceShiftAction,
  updateAttendanceShiftAction,
  type ActionState,
} from "../actions";
import { DeleteConfirmButton } from "../delete-confirm-button";

type Props = {
  companyId: string;
  branchId: string;
  branchName: string;
  shifts: AttendanceShift[];
  isSuperAdmin: boolean;
};

const inputClass =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl text-sm";
const labelClass = "block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5";
const timeInputProps = {
  type: "text" as const,
  inputMode: "numeric" as const,
  pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
  placeholder: "HH:MM",
  maxLength: 5,
  dir: "ltr" as const,
};
const timeInputClassSm = "px-2 py-1 border rounded-lg text-xs font-mono w-20";

function minutesBetween(start: string, end: string, crossesMidnight: boolean): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (crossesMidnight || endM <= startM) endM += 24 * 60;
  return Math.max(0, endM - startM);
}

function submitAssociatedForm(
  formId: string,
  action: (formData: FormData) => void,
  extra?: Record<string, string>,
) {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      fd.set(key, value);
    }
  }
  action(fd);
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

function CreateShiftForm({
  companyId,
  branchId,
  action,
  pending,
  state,
}: {
  companyId: string;
  branchId: string;
  action: (formData: FormData) => void;
  pending: boolean;
  state: ActionState | undefined;
}) {
  const router = useRouter();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [crossesMidnight, setCrossesMidnight] = useState(false);
  const [expectedMinutes, setExpectedMinutes] = useState<number | "">("");
  const [isExpectedOverridden, setIsExpectedOverridden] = useState(false);
  const [lateGrace, setLateGrace] = useState(15);
  const [earlyGrace, setEarlyGrace] = useState(15);

  const autoMinutes =
    startTime && endTime ? minutesBetween(startTime, endTime, crossesMidnight) : 0;

  useEffect(() => {
    if (!isExpectedOverridden && autoMinutes > 0) {
      setExpectedMinutes(autoMinutes);
    }
  }, [autoMinutes, isExpectedOverridden]);

  useEffect(() => {
    if (state?.ok) {
      setStartTime("");
      setEndTime("");
      setCrossesMidnight(false);
      setExpectedMinutes("");
      setIsExpectedOverridden(false);
      setLateGrace(15);
      setEarlyGrace(15);
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="branch_id" value={branchId} />

      <Field label="اسم الوردية">
        <input
          name="name"
          required
          placeholder="مثال: ليلية، صباحية"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="وقت الدخول">
          <input
            name="start_time"
            {...timeInputProps}
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="وقت الخروج">
          <input
            name="end_time"
            {...timeInputProps}
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="نوع الوردية">
          <label className="flex h-[42px] items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 text-sm">
            <input type="hidden" name="crosses_midnight" value={crossesMidnight ? "true" : "false"} />
            <input
              type="checkbox"
              checked={crossesMidnight}
              onChange={(e) => setCrossesMidnight(e.target.checked)}
              className="rounded"
            />
            تتجاوز منتصف الليل
          </label>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="المدة المتوقعة (دقيقة)"
          hint={
            autoMinutes > 0 && !isExpectedOverridden
              ? `محسوب تلقائياً: ${autoMinutes} دقيقة`
              : undefined
          }
        >
          <input
            name="expected_minutes"
            type="number"
            required
            min={1}
            value={expectedMinutes}
            onChange={(e) => {
              setIsExpectedOverridden(true);
              const val = e.target.value;
              setExpectedMinutes(val === "" ? "" : Number(val));
            }}
            className={inputClass}
          />
        </Field>

        {crossesMidnight ? (
          <Field
            label="آخر خروج مسموح (اختياري)"
            hint="أقصى وقت للخروج في اليوم التالي — يُحسب للوردية السابقة"
          >
            <input
              name="checkout_cutoff_time"
              {...timeInputProps}
              className={inputClass}
            />
          </Field>
        ) : (
          <input type="hidden" name="checkout_cutoff_time" value="" />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="فترة سماح التأخير (دقيقة)">
          <input
            name="late_grace_minutes"
            type="number"
            min={0}
            value={lateGrace}
            onChange={(e) => setLateGrace(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="فترة سماح الخروج المبكر (دقيقة)">
          <input
            name="early_leave_grace_minutes"
            type="number"
            min={0}
            value={earlyGrace}
            onChange={(e) => setEarlyGrace(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
      >
        {pending ? "جاري الإضافة..." : "إضافة وردية"}
      </button>

      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-600">تمت إضافة الوردية</p>
      ) : null}
    </form>
  );
}

export function ShiftManager({
  companyId,
  branchId,
  branchName,
  shifts,
  isSuperAdmin,
}: Props) {
  const [createState, createAction, createPending] = useActionState<
    ActionState | undefined,
    FormData
  >(createAttendanceShiftAction, undefined);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold">ورديات فرع {branchName}</h3>
        <CreateShiftForm
          companyId={companyId}
          branchId={branchId}
          action={createAction}
          pending={createPending}
          state={createState}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
          الورديات المعرفة
        </h3>
        {shifts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500 text-center">
            لا توجد ورديات لهذا الفرع بعد. أضف وردية أولاً ثم عيّنها للموظفين.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-right">
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">البداية</th>
                  <th className="px-4 py-3">النهاية</th>
                  <th className="px-4 py-3">المدة</th>
                  <th className="px-4 py-3">ليلية</th>
                  <th className="px-4 py-3">آخر خروج</th>
                  <th className="px-4 py-3">فترة التأخير</th>
                  <th className="px-4 py-3">فترة الخروج المبكر</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">تعديل</th>
                  {isSuperAdmin ? <th className="px-4 py-3">حذف</th> : null}
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} isSuperAdmin={isSuperAdmin} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftRow({
  shift,
  isSuperAdmin,
}: {
  shift: AttendanceShift;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const formId = `shift-${shift.id}`;
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateAttendanceShiftAction,
    undefined,
  );
  const [crossesMidnight, setCrossesMidnight] = useState(shift.crosses_midnight);

  useEffect(() => {
    setCrossesMidnight(shift.crosses_midnight);
  }, [shift.crosses_midnight]);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  const suggestedMinutes = minutesBetween(
    shift.start_time.slice(0, 5),
    shift.end_time.slice(0, 5),
    crossesMidnight,
  );

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800">
      <td className="px-4 py-3">
        <form id={formId} className="contents" onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" name="id" value={shift.id} />
          <input type="hidden" name="company_id" value={shift.company_id} />
          <input type="hidden" name="branch_id" value={shift.branch_id} />
          <input
            type="hidden"
            name="crosses_midnight"
            value={crossesMidnight ? "true" : "false"}
          />
          <input
            name="name"
            defaultValue={shift.name}
            className="w-full min-w-[100px] px-2 py-1 border rounded-lg text-xs"
          />
        </form>
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="start_time"
          {...timeInputProps}
          defaultValue={shift.start_time.slice(0, 5)}
          className="px-2 py-1 border rounded-lg text-xs w-20"
        />
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="end_time"
          {...timeInputProps}
          defaultValue={shift.end_time.slice(0, 5)}
          className="px-2 py-1 border rounded-lg text-xs w-20"
        />
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="expected_minutes"
          type="number"
          min={1}
          defaultValue={shift.expected_minutes}
          placeholder={String(suggestedMinutes)}
          title={`محسوب: ${suggestedMinutes} دقيقة`}
          className="w-20 px-2 py-1 border rounded-lg text-xs"
        />
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={crossesMidnight}
          onChange={(e) => setCrossesMidnight(e.target.checked)}
          title="تتجاوز منتصف الليل"
        />
      </td>
      <td className="px-4 py-3">
        {crossesMidnight ? (
          <input
            form={formId}
            name="checkout_cutoff_time"
            {...timeInputProps}
            defaultValue={shift.checkout_cutoff_time?.slice(0, 5) ?? ""}
            className="px-2 py-1 border rounded-lg text-xs w-20"
            title="آخر خروج مسموح (للورديات الليلية)"
          />
        ) : (
          <input type="hidden" form={formId} name="checkout_cutoff_time" value="" />
        )}
        {!crossesMidnight ? (
          <span className="text-xs text-gray-400">—</span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="late_grace_minutes"
          type="number"
          min={0}
          defaultValue={shift.late_grace_minutes}
          className="w-16 px-2 py-1 border rounded-lg text-xs"
          title="فترة سماح التأخير (دقيقة)"
        />
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="early_leave_grace_minutes"
          type="number"
          min={0}
          defaultValue={shift.early_leave_grace_minutes}
          className="w-16 px-2 py-1 border rounded-lg text-xs"
          title="فترة سماح الخروج المبكر (دقيقة)"
        />
      </td>
      <td className="px-4 py-3">
        <form action={toggleAttendanceShiftAction}>
          <input type="hidden" name="id" value={shift.id} />
          <input
            type="hidden"
            name="active"
            value={shift.active ? "false" : "true"}
          />
          <button
            type="submit"
            className={`text-xs px-2 py-1 rounded-full font-semibold ${
              shift.active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {shift.active ? "نشط" : "معطل"}
          </button>
        </form>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            submitAssociatedForm(formId, action, {
              crosses_midnight: crossesMidnight ? "true" : "false",
            })
          }
          className="text-xs px-2 py-1 bg-primary-600 text-white rounded-lg disabled:opacity-60"
        >
          {pending ? "..." : "حفظ"}
        </button>
        {state?.error ? (
          <span className="block text-xs text-red-600 mt-1">{state.error}</span>
        ) : null}
        {state?.ok ? (
          <span className="block text-xs text-emerald-600 mt-1">تم الحفظ</span>
        ) : null}
      </td>
      {isSuperAdmin ? (
        <td className="px-4 py-3">
          <DeleteConfirmButton
            label="حذف"
            confirmMessage={`حذف وردية "${shift.name}"؟`}
            action={deleteAttendanceShiftAction}
            hiddenFields={{ id: shift.id }}
          />
        </td>
      ) : null}
    </tr>
  );
}
