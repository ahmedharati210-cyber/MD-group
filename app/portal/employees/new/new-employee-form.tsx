"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { createEmployeeAction, type ActionState } from "../actions";
import type { UserRole } from "@/types/db";

type Company = { id: string; name_ar: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ الحفظ...
        </>
      ) : (
        "إضافة الموظف"
      )}
    </button>
  );
}

type Props = {
  companies: Company[];
  currentRole: UserRole;
  currentCompanyId: string | null;
};

export function NewEmployeeForm({
  companies,
  currentRole,
  currentCompanyId,
}: Props) {
  const [state, action] = useActionState<ActionState, FormData>(
    createEmployeeAction,
    {},
  );

  const isManager = currentRole === "company_manager";
  const lockedCompanyId = isManager ? currentCompanyId ?? "" : "";

  return (
    <form action={action} className="space-y-5">
      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="الاسم الكامل" name="full_name" required />
        <Field label="الوظيفة" name="job_title" placeholder="محاسب، مهندس..." />
        <Field label="البريد الإلكتروني" name="email" type="email" required />
        <Field
          label="كلمة المرور المبدئية"
          name="password"
          type="password"
          required
          minLength={8}
          hint="8 أحرف على الأقل"
        />
        <Field label="رقم الهاتف" name="phone" type="tel" />
        <Field label="رقم جواز السفر" name="national_id" />
        <Field label="تاريخ التوظيف" name="hired_at" type="date" />

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            الشركة
          </label>
          <select
            name="company_id"
            required
            disabled={isManager}
            defaultValue={lockedCompanyId || undefined}
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none disabled:bg-gray-50 dark:disabled:bg-gray-900"
          >
            <option value="">اختر الشركة</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        {!isManager ? (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              الدور
            </label>
            <select
              name="role"
              defaultValue="employee"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
            >
              <option value="employee">موظف</option>
              <option value="company_manager">مدير شركة</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="role" value="employee" />
        )}
      </div>

      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={props.name}
        className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
      >
        {label}
      </label>
      <input
        id={props.name}
        {...props}
        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
      />
      {hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}
