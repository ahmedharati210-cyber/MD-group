"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Save } from "lucide-react";
import type { ActionState } from "./actions";
import type { Contact } from "@/types/db";

type Company = { id: string; name_ar: string };

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

type Action = (
  state: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

function Submit({ label }: { label: string }) {
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
          {label}
        </>
      )}
    </button>
  );
}

type Props = {
  action: Action;
  companies: Company[];
  lockedCompanyId: string | null;
  initial?: Partial<Contact> | null;
  submitLabel?: string;
  /** Show construction-specific trade category field (Emaar Al Youm only) */
  showTradeCategory?: boolean;
};

export function ContactForm({
  action,
  companies,
  lockedCompanyId,
  initial,
  submitLabel = "حفظ",
  showTradeCategory = false,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          label="الاسم الكامل"
          name="full_name"
          required
          defaultValue={initial?.full_name ?? ""}
        />
        <Field
          label="المسمى الوظيفي"
          name="title"
          defaultValue={initial?.title ?? ""}
        />
        <Field
          label="المنظمة / الجهة"
          name="organization"
          defaultValue={initial?.organization ?? ""}
        />
        <Field
          label="رقم الهاتف"
          name="phone"
          type="tel"
          defaultValue={initial?.phone ?? ""}
        />
        <Field
          label="البريد الإلكتروني"
          name="email"
          type="email"
          defaultValue={initial?.email ?? ""}
        />
        <div>
          <label className={labelClasses}>الشركة المرتبطة</label>
          <select
            name="company_id"
            disabled={!!lockedCompanyId}
            defaultValue={lockedCompanyId ?? initial?.company_id ?? ""}
            className={`${inputClasses} disabled:bg-gray-50 dark:disabled:bg-gray-900`}
          >
            <option value="">— على مستوى المجموعة —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>
        {showTradeCategory ? (
          <div>
            <label className={labelClasses}>التخصص / الفئة</label>
            <select
              name="trade_category"
              defaultValue={(initial as { trade_category?: string | null })?.trade_category ?? ""}
              className={inputClasses}
            >
              <option value="">— غير محدد —</option>
              <option value="laborer">عمال</option>
              <option value="technician">فني</option>
              <option value="mechanic">ميكانيكي</option>
              <option value="electrician">كهربائي</option>
              <option value="other">أخرى</option>
            </select>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className={labelClasses}>ملاحظات</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={initial?.notes ?? ""}
            className={`${inputClasses} resize-none`}
          />
        </div>
      </div>

      <Submit label={submitLabel} />
    </form>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className={labelClasses}>{label}</label>
      <input {...props} className={inputClasses} />
    </div>
  );
}
