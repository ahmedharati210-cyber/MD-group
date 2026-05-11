"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import toast from "react-hot-toast";
import { Link2, Loader2 } from "lucide-react";
import {
  generateInviteTokenAction,
  type InviteTokenState,
} from "@/app/portal/employees/actions";

function SubmitInviteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm shadow-md hover:bg-primary-700 transition-colors disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ الإنشاء...
        </>
      ) : (
        <>
          <Link2 className="w-4 h-4" />
          إنشاء رابط دعوة
        </>
      )}
    </button>
  );
}

export function InviteLinkGenerator({
  companyNameAr,
}: {
  /** Usually «الطريق الصحيح» — Dolce signup is fixed to this company server-side */
  companyNameAr: string;
}) {
  const [state, formAction] = useActionState<
    InviteTokenState,
    FormData
  >(generateInviteTokenAction, {});

  useEffect(() => {
    if (state?.ok && state.inviteUrl) {
      toast.success("تم إنشاء رابط الدعوة.", { id: "invite-created" });
    }
  }, [state?.ok, state?.inviteUrl]);

  const handleCopy = async () => {
    const url = state?.inviteUrl;
    if (!url || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط.", { id: "invite-copy" });
    } catch {
      toast.error("تعذّر النسخ.", { id: "invite-copy-err" });
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-50 mb-1">
        رابط تسجيل Dolce Chocolate
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        مخصّص لشركة{" "}
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {companyNameAr}
        </span>
        . أنشئ رابطاً آمناً صالحاً لمدة 7 أيام لمرة واحدة، وأرسله للموظف لملء
        بياناته قبل الموافقة.
      </p>

      <form action={formAction} className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <SubmitInviteButton />
      </form>

      {state?.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      {state?.ok && state.inviteUrl ? (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={state.inviteUrl}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 font-mono"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90"
          >
            نسخ الرابط
          </button>
        </div>
      ) : null}
    </div>
  );
}
