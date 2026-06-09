"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2, Save } from "lucide-react";
import {
  createAttendanceAction,
  type ActionState,
} from "../actions";

type Company = { id: string; name_ar: string };
type Employee = {
  id: string;
  full_name: string;
  company_id: string | null;
};

type Props = {
  companies: Company[];
  employees: Employee[];
  lockedCompanyId: string | null;
  isAdmin: boolean;
  defaultDate: string;
  defaultEmployeeId?: string | null;
  defaultStatus?: "present" | "absent" | "late" | "leave";
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultNotes?: string;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ الحفظ...
        </>
      ) : (
        <>
          <Save className="w-4 h-4" />
          حفظ السجل
        </>
      )}
    </button>
  );
}

export function AttendanceForm({
  companies,
  employees,
  lockedCompanyId,
  isAdmin,
  defaultDate,
  defaultEmployeeId,
  defaultStatus = "present",
  defaultCheckIn = "",
  defaultCheckOut = "",
  defaultNotes = "",
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createAttendanceAction,
    {},
  );

  const [selectedCompany, setSelectedCompany] = useState<string>(
    lockedCompanyId ?? "",
  );

  const filteredEmployees = useMemo(() => {
    if (!isAdmin && lockedCompanyId) {
      return employees.filter((e) => e.company_id === lockedCompanyId);
    }
    if (!selectedCompany) return employees;
    return employees.filter((e) => e.company_id === selectedCompany);
  }, [employees, selectedCompany, lockedCompanyId, isAdmin]);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        {isAdmin ? (
          <div>
            <label className={labelClasses}>الشركة</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className={inputClasses}
            >
              <option value="">كل الشركات</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ar}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={isAdmin ? "" : "sm:col-span-2"}>
          <label className={labelClasses}>الموظف</label>
          <select
            name="profile_id"
            required
            defaultValue={defaultEmployeeId ?? ""}
            className={inputClasses}
          >
            <option value="">اختر الموظف</option>
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClasses}>التاريخ</label>
          <input
            type="date"
            name="date"
            required
            defaultValue={defaultDate}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>الحالة</label>
          <select
            name="status"
            required
            defaultValue={defaultStatus}
            className={inputClasses}
          >
            <option value="present">حاضر</option>
            <option value="late">متأخر</option>
            <option value="absent">غائب</option>
            <option value="leave">إجازة</option>
          </select>
        </div>

        <div>
          <label className={labelClasses}>وقت الحضور</label>
          <input
            type="time"
            name="check_in"
            defaultValue={defaultCheckIn}
            className={inputClasses}
            dir="ltr"
          />
        </div>

        <div>
          <label className={labelClasses}>وقت الانصراف</label>
          <input
            type="time"
            name="check_out"
            defaultValue={defaultCheckOut}
            className={inputClasses}
            dir="ltr"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>ملاحظات</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={defaultNotes}
            className={`${inputClasses} resize-none`}
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        إذا كان هناك سجل موجود مسبقًا لنفس الموظف في نفس اليوم، سيتم تحديثه.
      </p>

      <Submit />
    </form>
  );
}
