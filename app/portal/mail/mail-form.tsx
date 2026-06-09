"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2, Save } from "lucide-react";
import type { ActionState } from "./actions";
import type { Mail as MailRow } from "@/types/db";

type Company = { id: string; name_ar: string };
type Doc = { id: string; title: string };

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

type Action = (
  state: ActionState | undefined,
  formData: FormData,
) => Promise<ActionState>;

function Submit({ label = "حفظ" }: { label?: string }) {
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
  documents: Doc[];
  lockedCompanyId: string | null;
  initial?: Partial<MailRow> | null;
  submitLabel?: string;
};

export function MailForm({
  action,
  companies,
  documents,
  lockedCompanyId,
  initial,
  submitLabel,
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
          <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>الاتجاه</label>
          <select
            name="direction"
            required
            defaultValue={initial?.direction ?? "inbound"}
            className={inputClasses}
          >
            <option value="inbound">وارد</option>
            <option value="outbound">صادر</option>
          </select>
        </div>

        <div>
          <label className={labelClasses}>الشركة</label>
          <select
            name="company_id"
            required
            disabled={!!lockedCompanyId}
            defaultValue={lockedCompanyId ?? initial?.company_id ?? ""}
            className={`${inputClasses} disabled:bg-gray-50 dark:disabled:bg-gray-900`}
          >
            <option value="">اختر الشركة</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>الموضوع</label>
          <input
            name="subject"
            required
            defaultValue={initial?.subject ?? ""}
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>من</label>
          <input
            name="from_name"
            defaultValue={initial?.from_name ?? ""}
            placeholder="اسم المرسِل"
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>إلى</label>
          <input
            name="to_name"
            defaultValue={initial?.to_name ?? ""}
            placeholder="اسم المستلِم"
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>الحالة</label>
          <input
            name="status"
            defaultValue={initial?.status ?? ""}
            placeholder="قيد المعالجة..."
            className={inputClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>ورقة مرفقة (اختياري)</label>
          <select
            name="related_document_id"
            defaultValue={initial?.related_document_id ?? ""}
            className={inputClasses}
          >
            <option value="">— لا يوجد —</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClasses}>الملاحظات / المحتوى</label>
          <textarea
            name="body"
            rows={5}
            defaultValue={initial?.body ?? ""}
            className={`${inputClasses} resize-none`}
          />
        </div>
      </div>

      <Submit label={submitLabel} />
    </form>
  );
}
