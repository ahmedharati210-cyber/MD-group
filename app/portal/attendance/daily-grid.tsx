"use client";

import Link from "next/link";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteAttendanceAction,
  markAttendanceAction,
} from "./actions";
import { formatTime } from "@/lib/utils";

type Employee = {
  id: string;
  full_name: string;
  company_id: string;
  company_name: string | null;
};

type Record = {
  id: string;
  profile_id: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
};

type Props = {
  date: string;
  employees: Employee[];
  records: Record[];
};

const statuses: { value: "present" | "absent" | "late" | "leave"; label: string }[] = [
  { value: "present", label: "حاضر" },
  { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" },
  { value: "leave", label: "إجازة" },
];

export function DailyGrid({ date, employees, records }: Props) {
  const [pending, start] = useTransition();
  const byProfile = new Map(records.map((r) => [r.profile_id, r]));

  function update(employee: Employee, status: Record["status"]) {
    const form = new FormData();
    form.set("profile_id", employee.id);
    form.set("company_id", employee.company_id);
    form.set("date", date);
    form.set("status", status);
    start(async () => {
      await markAttendanceAction(form);
      toast.success("تم التحديث");
    });
  }

  function onDelete(recordId: string) {
    if (!window.confirm("هل أنت متأكد من حذف السجل؟")) return;
    const form = new FormData();
    form.set("id", recordId);
    start(async () => {
      await deleteAttendanceAction(form);
      toast.success("تم الحذف");
    });
  }

  function buttonClass(active: boolean) {
    return (
      "px-3 py-1 rounded-lg text-xs font-semibold border transition " +
      (active
        ? "bg-primary-600 text-white border-primary-600"
        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {employees.map((e) => {
          const r = byProfile.get(e.id);
          return (
            <div
              key={e.id}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                    {e.full_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {e.company_name ?? "—"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {r?.check_in ? formatTime(r.check_in) : "—"}
                    {r?.check_out ? ` → ${formatTime(r.check_out)}` : ""}
                  </div>
                </div>
                <RowActions
                  employeeId={e.id}
                  recordId={r?.id}
                  date={date}
                  pending={pending}
                  onDelete={onDelete}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => {
                  const active = (r?.status ?? "") === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      disabled={pending}
                      onClick={() => update(e, s.value)}
                      className={buttonClass(active)}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
              <tr className="text-right text-gray-600 dark:text-gray-400">
                <th className="px-5 py-3 font-semibold">الموظف</th>
                <th className="px-5 py-3 font-semibold">الشركة</th>
                <th className="px-5 py-3 font-semibold">الوقت</th>
                <th className="px-5 py-3 font-semibold">الحالة</th>
                <th className="px-5 py-3 font-semibold w-28">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {employees.map((e) => {
                const r = byProfile.get(e.id);
                return (
                  <tr key={e.id}>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {e.full_name}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                      {e.company_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {r?.check_in ? formatTime(r.check_in) : "—"}
                      {r?.check_out ? ` → ${formatTime(r.check_out)}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {statuses.map((s) => {
                          const active = (r?.status ?? "") === s.value;
                          return (
                            <button
                              key={s.value}
                              type="button"
                              disabled={pending}
                              onClick={() => update(e, s.value)}
                              className={buttonClass(active)}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <RowActions
                        employeeId={e.id}
                        recordId={r?.id}
                        date={date}
                        pending={pending}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function RowActions({
  employeeId,
  recordId,
  date,
  pending,
  onDelete,
}: {
  employeeId: string;
  recordId?: string;
  date: string;
  pending: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Link
        href={`/portal/attendance/new?date=${date}&profileId=${employeeId}`}
        aria-label="تعديل الأوقات"
        title="تعديل الأوقات"
        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Pencil className="w-4 h-4" />
      </Link>
      {recordId ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onDelete(recordId)}
          aria-label="حذف السجل"
          title="حذف السجل"
          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}
