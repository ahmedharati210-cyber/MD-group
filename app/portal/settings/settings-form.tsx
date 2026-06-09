"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import toast from "react-hot-toast";
import { CircleAlert, Loader2 } from "lucide-react";
import { updateSelfAction, type ActionState } from "./actions";

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
        "حفظ التغييرات"
      )}
    </button>
  );
}

type Props = {
  profileId: string;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
};

export function SettingsForm({ fullName, phone, jobTitle }: Props) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateSelfAction,
    {},
  );

  useEffect(() => {
    if (state?.ok) toast.success("تم حفظ التغييرات");
  }, [state]);

  return (
    <form action={action} className="space-y-5">
      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="الاسم الكامل" name="full_name" defaultValue={fullName} required />
        <Field label="الوظيفة" name="job_title" defaultValue={jobTitle ?? ""} />
        <Field
          label="رقم الهاتف"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
        />
      </div>
      <Submit />
    </form>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
      />
    </div>
  );
}
