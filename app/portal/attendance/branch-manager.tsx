"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createAttendanceBranchAction,
  createAttendancePersonAction,
  deleteAttendanceBranchAction,
  deleteAttendancePersonAction,
  toggleAttendanceBranchAction,
  toggleAttendancePersonAction,
  updateAttendancePersonAction,
  type ActionState,
} from "./actions";
import { DeleteConfirmButton } from "./delete-confirm-button";
import type { AttendanceBranch, AttendancePerson } from "@/types/db";
import { normalizeSearchQuery, matchesAttendanceSearch } from "@/lib/attendance/search";
import {
  formatPersonCustomScheduleLabel,
  personHasCustomSchedule,
} from "@/lib/attendance/person-schedule";

const WEEKDAY_OPTIONS = [
  { value: 0, label: "أحد" },
  { value: 1, label: "إثن" },
  { value: 2, label: "ثلا" },
  { value: 3, label: "أرب" },
  { value: 4, label: "خمي" },
  { value: 5, label: "جمع" },
  { value: 6, label: "سبت" },
] as const;

const timeInputProps = {
  type: "text" as const,
  inputMode: "numeric" as const,
  pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$",
  placeholder: "HH:MM",
  maxLength: 5,
  dir: "ltr" as const,
};

function submitAssociatedForm(
  formId: string,
  action: (formData: FormData) => void,
) {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return;
  action(new FormData(form));
}

type Props = {
  companyId: string;
  branches: AttendanceBranch[];
  people: AttendancePerson[];
  selectedBranchId: string | null;
  searchQuery?: string;
  isSuperAdmin: boolean;
};

export function BranchManager({
  companyId,
  branches,
  people,
  selectedBranchId,
  searchQuery = "",
  isSuperAdmin,
}: Props) {
  const [branchState, branchAction, branchPending] = useActionState<
    ActionState | undefined,
    FormData
  >(createAttendanceBranchAction, undefined);

  const [personState, personAction, personPending] = useActionState<
    ActionState | undefined,
    FormData
  >(createAttendancePersonAction, undefined);

  const needle = normalizeSearchQuery(searchQuery);
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  const filteredPeople = people.filter((p) => {
    if (selectedBranchId && p.branch_id !== selectedBranchId) return false;
    if (!needle) return true;
    return matchesAttendanceSearch(needle, [
      p.full_name,
      p.external_employee_number,
      p.notes,
      branchMap.get(p.branch_id),
    ]);
  });

  const activeBranches = branches.filter((b) => b.active);
  const defaultBranchId = selectedBranchId ?? activeBranches[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold">إضافة فرع</h3>
          <form action={branchAction} className="grid sm:grid-cols-2 gap-3">
            <input type="hidden" name="company_id" value={companyId} />
            <input
              name="name"
              required
              placeholder="اسم الفرع"
              className="px-3 py-2.5 border rounded-xl sm:col-span-2"
            />
            <input
              name="code"
              placeholder="رمز (اختياري)"
              className="px-3 py-2.5 border rounded-xl"
            />
            <button
              type="submit"
              disabled={branchPending}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm"
            >
              إضافة فرع
            </button>
            {branchState?.error ? (
              <p className="text-sm text-red-600 sm:col-span-2">{branchState.error}</p>
            ) : null}
          </form>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold">إضافة شخص حضور</h3>
          <p className="text-sm text-gray-500">
            قائمة منفصلة عن موظفي البوابة — للحضور والبصمة فقط.
          </p>
          <form action={personAction} className="grid sm:grid-cols-2 gap-3">
            <input type="hidden" name="company_id" value={companyId} />
            <select
              name="branch_id"
              required
              defaultValue={defaultBranchId}
              className="px-3 py-2.5 border rounded-xl sm:col-span-2"
            >
              <option value="">اختر الفرع</option>
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              name="external_employee_number"
              required
              placeholder="رقم البصمة"
              className="px-3 py-2.5 border rounded-xl"
              dir="ltr"
            />
            <input
              name="full_name"
              required
              placeholder="الاسم"
              className="px-3 py-2.5 border rounded-xl"
            />
            <button
              type="submit"
              disabled={personPending || !defaultBranchId}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm sm:col-span-2"
            >
              إضافة
            </button>
          </form>
          {personState?.error ? (
            <p className="text-sm text-red-600">{personState.error}</p>
          ) : null}
          {personState?.ok ? (
            <p className="text-sm text-emerald-600">تمت الإضافة</p>
          ) : null}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
          الفروع
        </h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-right">
              <th className="px-4 py-3">الفرع</th>
              <th className="px-4 py-3">الرمز</th>
              <th className="px-4 py-3">الورديات</th>
              <th className="px-4 py-3">الحالة</th>
              {isSuperAdmin ? <th className="px-4 py-3">حذف</th> : null}
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.code ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/portal/attendance/branches?companyId=${companyId}&branchId=${b.id}#shifts`}
                    className="text-xs text-primary-600 underline font-semibold"
                  >
                    الورديات
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleAttendanceBranchAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={b.active ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        b.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {b.active ? "نشط" : "معطل"}
                    </button>
                  </form>
                </td>
                {isSuperAdmin ? (
                  <td className="px-4 py-3">
                    <BranchDeleteButton branchId={b.id} branchName={b.name} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <h3 className="px-4 py-3 font-bold border-b border-gray-100 dark:border-gray-800">
          قائمة الحضور {selectedBranchId ? "للفرع المحدد" : ""}
          {needle ? ` — نتائج البحث` : ""}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-right">
                <th className="px-4 py-3">الاسم والجدول</th>
                <th className="px-4 py-3">رقم البصمة</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">تعديل</th>
                {isSuperAdmin ? <th className="px-4 py-3">حذف</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredPeople.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 6 : 5}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    {needle
                      ? "لا توجد نتائج مطابقة للبحث."
                      : "لا يوجد أشخاص في قائمة الحضور بعد."}
                  </td>
                </tr>
              ) : (
                filteredPeople.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    branchName={branchMap.get(person.branch_id) ?? "—"}
                    isSuperAdmin={isSuperAdmin}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BranchDeleteButton({
  branchId,
  branchName,
}: {
  branchId: string;
  branchName: string;
}) {
  return (
    <DeleteConfirmButton
      label="حذف"
      confirmMessage={`حذف فرع "${branchName}"؟ إذا كان يحتوي بيانات، سيطلب تأكيداً إضافياً.`}
      action={async (fd) => {
        const first = await deleteAttendanceBranchAction(fd);
        if (first.error?.includes("أعد المحاولة مع التأكيد")) {
          if (window.confirm(first.error + "\n\nهل تريد المتابعة؟")) {
            fd.set("confirm", "true");
            return deleteAttendanceBranchAction(fd);
          }
        }
        return first;
      }}
      hiddenFields={{ id: branchId }}
    />
  );
}

function PersonRow({
  person,
  branchName,
  isSuperAdmin,
}: {
  person: AttendancePerson;
  branchName: string;
  isSuperAdmin: boolean;
}) {
  const formId = `person-${person.id}`;
  const [state, action, pending] = useActionState<ActionState | undefined, FormData>(
    updateAttendancePersonAction,
    undefined,
  );
  const scheduleLabel = formatPersonCustomScheduleLabel(person);
  const workDays = person.custom_work_days ?? [];

  return (
    <tr className="border-t border-gray-100 dark:border-gray-800 align-top">
      <td className="px-4 py-3 space-y-2 min-w-[18rem]">
        <form id={formId} className="contents" onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" name="id" value={person.id} />
          <input
            name="full_name"
            defaultValue={person.full_name}
            className="w-full px-2 py-1 border rounded-lg text-xs"
          />
        </form>
        {scheduleLabel ? (
          <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200">
            {scheduleLabel}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">بدون جدول مخصص (أقرب وردية فرع)</span>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            form={formId}
            name="custom_start_time"
            {...timeInputProps}
            defaultValue={person.custom_start_time?.slice(0, 5) ?? ""}
            title="بداية الدوام"
            className="w-[4.5rem] px-1.5 py-1 border rounded-lg text-[11px] font-mono"
          />
          <span className="text-gray-400 text-xs">–</span>
          <input
            form={formId}
            name="custom_end_time"
            {...timeInputProps}
            defaultValue={person.custom_end_time?.slice(0, 5) ?? ""}
            title="نهاية الدوام"
            className="w-[4.5rem] px-1.5 py-1 border rounded-lg text-[11px] font-mono"
          />
          <label className="inline-flex items-center gap-1 text-[10px] text-gray-600">
            <input
              form={formId}
              type="checkbox"
              name="custom_crosses_midnight"
              value="true"
              defaultChecked={person.custom_crosses_midnight}
            />
            منتصف الليل
          </label>
          <input
            form={formId}
            type="number"
            name="custom_late_grace_minutes"
            min={0}
            max={180}
            defaultValue={person.custom_late_grace_minutes ?? 15}
            title="سماح التأخير (د)"
            className="w-14 px-1.5 py-1 border rounded-lg text-[11px]"
          />
          <input
            form={formId}
            type="number"
            name="custom_early_leave_grace_minutes"
            min={0}
            max={180}
            defaultValue={person.custom_early_leave_grace_minutes ?? 15}
            title="سماح الخروج المبكر (د)"
            className="w-14 px-1.5 py-1 border rounded-lg text-[11px]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_OPTIONS.map((day) => (
            <label
              key={day.value}
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700"
            >
              <input
                form={formId}
                type="checkbox"
                name="custom_work_days"
                value={day.value}
                defaultChecked={
                  personHasCustomSchedule(person)
                    ? workDays.includes(day.value)
                    : true
                }
              />
              {day.label}
            </label>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">
          اترك الأوقات فارغة للعودة لمطابقة ورديات الفرع.
        </p>
      </td>
      <td className="px-4 py-3">
        <input
          form={formId}
          name="external_employee_number"
          defaultValue={person.external_employee_number}
          className="w-24 px-2 py-1 border rounded-lg text-xs"
          dir="ltr"
        />
      </td>
      <td className="px-4 py-3 text-gray-500">{branchName}</td>
      <td className="px-4 py-3">
        <form action={toggleAttendancePersonAction}>
          <input type="hidden" name="id" value={person.id} />
          <input
            type="hidden"
            name="active"
            value={person.active ? "false" : "true"}
          />
          <button
            type="submit"
            className={`text-xs px-2 py-1 rounded-full font-semibold ${
              person.active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {person.active ? "نشط" : "معطل"}
          </button>
        </form>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => submitAssociatedForm(formId, action)}
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
          <PersonDeleteButton personId={person.id} personName={person.full_name} />
        </td>
      ) : null}
    </tr>
  );
}

function PersonDeleteButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  return (
    <DeleteConfirmButton
      label="حذف"
      confirmMessage={`حذف "${personName}" من قائمة الحضور؟`}
      action={async (fd) => {
        const first = await deleteAttendancePersonAction(fd);
        if (first.error?.includes("احذف الاستيراد")) {
          if (window.confirm(first.error + "\n\nحذف قسري مع السجلات؟")) {
            fd.set("force", "true");
            return deleteAttendancePersonAction(fd);
          }
        }
        return first;
      }}
      hiddenFields={{ id: personId }}
    />
  );
}
