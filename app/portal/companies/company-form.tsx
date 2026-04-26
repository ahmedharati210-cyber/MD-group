"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import type { ActionState } from "./actions";
import type { Company } from "@/types/db";

type Action = (
  state: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

type Props = {
  action: Action;
  initial?: Partial<Company> | null;
  submitLabel?: string;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

export function CompanyForm({ action, initial, submitLabel = "حفظ" }: Props) {
  const [state, formAction, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClasses}>الاسم بالعربية</label>
          <input
            name="name_ar"
            required
            defaultValue={initial?.name_ar ?? ""}
            className={inputClasses}
            placeholder="مثال: شركة الإنشاءات المتحدة"
          />
        </div>

        <div>
          <label className={labelClasses}>الاسم بالإنجليزية</label>
          <input
            name="name_en"
            defaultValue={initial?.name_en ?? ""}
            className={inputClasses}
            placeholder="United Construction"
          />
        </div>

        <div>
          <label className={labelClasses}>المعرّف (slug)</label>
          <input
            name="slug"
            required
            defaultValue={initial?.slug ?? ""}
            className={inputClasses}
            placeholder="united-construction"
            dir="ltr"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            يُستخدم داخليًا فقط — أحرف لاتينية صغيرة وأرقام وشرطات.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>رابط الشعار (اختياري)</label>
          <input
            name="logo_url"
            defaultValue={initial?.logo_url ?? ""}
            className={inputClasses}
            placeholder="https://..."
            dir="ltr"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="active"
              defaultChecked={initial?.active ?? true}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            الشركة نشطة
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
            {submitLabel}
          </>
        )}
      </button>
    </form>
  );
}
