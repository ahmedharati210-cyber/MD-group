"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Loader2, X } from "lucide-react";
import {
  approveSignupRequestAction,
  rejectSignupRequestAction,
  type SignupReviewState,
} from "./actions";

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Check className="w-3.5 h-3.5" />
      )}
      قبول
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <X className="w-3.5 h-3.5" />
      )}
      رفض
    </button>
  );
}

export function SignupRequestActions({
  requestId,
  redirectTo,
}: {
  requestId: string;
  /** After success, navigate here (e.g. back to the queue). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [approveState, approveAction] = useActionState<
    SignupReviewState,
    FormData
  >(approveSignupRequestAction, {});
  const [rejectState, rejectAction] = useActionState<
    SignupReviewState,
    FormData
  >(rejectSignupRequestAction, {});

  useEffect(() => {
    if (approveState?.ok) {
      const hint = approveState.internalAuthEmail;
      const msg = hint
        ? `تم إنشاء الحساب. بريد الدخول الداخلي لـ Supabase: ${hint}. عيّن كلمة المرور من لوحة المستخدمين أو Auth.`
        : "تم قبول الطلب.";
      toast.success(msg, {
        id: `approve-${requestId}`,
        duration: 12000,
      });
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    }
  }, [
    approveState?.ok,
    approveState?.internalAuthEmail,
    requestId,
    redirectTo,
    router,
  ]);

  useEffect(() => {
    if (rejectState?.ok) {
      toast.success("تم رفض الطلب.", { id: `reject-${requestId}` });
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    }
  }, [rejectState?.ok, requestId, redirectTo, router]);

  const err = approveState?.error ?? rejectState?.error;

  return (
    <div className="flex flex-col gap-2 items-stretch sm:items-end">
      {err ? (
        <p className="text-xs text-red-600 dark:text-red-400 text-right max-w-xs">
          {err}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 justify-end">
        <form action={approveAction} className="inline">
          <input type="hidden" name="request_id" value={requestId} />
          <ApproveButton />
        </form>
        <form action={rejectAction} className="inline-flex flex-col gap-1 items-end">
          <input type="hidden" name="request_id" value={requestId} />
          <textarea
            name="rejection_reason"
            placeholder="سبب الرفض (اختياري)"
            rows={2}
            className="w-full sm:w-48 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-1"
          />
          <RejectButton />
        </form>
      </div>
    </div>
  );
}
