"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { updateEmployeeAction, type ActionState } from "../../actions";
import type { Profile } from "@/types/db";

type Company = { id: string; name_ar: string };

type Props = {
  profile: Profile;
  companies: Company[];
  canChangeRole: boolean;
  canChangeCompany: boolean;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

export function EditEmployeeForm({
  profile,
  companies,
  canChangeRole,
  canChangeCompany,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateEmployeeAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={profile.id} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClasses}>الاسم الكامل</label>
          <input
            name="full_name"
            required
            defaultValue={profile.full_name}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>الهاتف</label>
          <input
            name="phone"
            defaultValue={profile.phone ?? ""}
            className={inputClasses}
            dir="ltr"
          />
        </div>

        <div>
          <label className={labelClasses}>المسمى الوظيفي</label>
          <input
            name="job_title"
            defaultValue={profile.job_title ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>الرقم الوطني</label>
          <input
            name="national_id"
            defaultValue={profile.national_id ?? ""}
            className={inputClasses}
            dir="ltr"
          />
        </div>

        <div>
          <label className={labelClasses}>تاريخ التوظيف</label>
          <input
            type="date"
            name="hired_at"
            defaultValue={profile.hired_at ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>الشركة</label>
          <select
            name="company_id"
            defaultValue={profile.company_id ?? ""}
            disabled={!canChangeCompany}
            className={`${inputClasses} disabled:bg-gray-50 dark:disabled:bg-gray-900`}
          >
            <option value="">— بدون —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClasses}>الدور</label>
          <select
            name="role"
            defaultValue={profile.role}
            disabled={!canChangeRole}
            className={`${inputClasses} disabled:bg-gray-50 dark:disabled:bg-gray-900`}
          >
            <option value="employee">موظف</option>
            <option value="company_manager">مدير شركة</option>
            <option value="md_admin">مدير مجموعة</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={profile.is_active}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            المستخدم نشط
          </label>
        </div>
      </div>

      {state?.error ? (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {state.error}
        </div>
      ) : null}

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
            حفظ التعديلات
          </>
        )}
      </button>
    </form>
  );
}
