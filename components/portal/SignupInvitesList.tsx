"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Calendar,
  CalendarClock,
  Copy,
  Loader2,
  Trash2,
  Users,
} from "lucide-react";
import {
  deleteSignupInviteAction,
  type DeleteSignupInviteState,
} from "@/app/portal/employees/actions";
import { formatDate } from "@/lib/utils";

export type SignupInviteRow = {
  id: string;
  invite_url: string;
  token_expires_at: string;
  max_uses: number;
  use_count: number;
  created_at: string;
};

function inviteStatus(row: SignupInviteRow): "active" | "expired" | "exhausted" {
  const expires = new Date(row.token_expires_at).getTime();
  if (Number.isFinite(expires) && expires < Date.now()) return "expired";
  if (row.use_count >= row.max_uses) return "exhausted";
  return "active";
}

function DeleteInviteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
      aria-label="حذف الرابط"
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="w-4 h-4" aria-hidden />
      )}
      حذف
    </button>
  );
}

export function SignupInvitesList({ invites }: { invites: SignupInviteRow[] }) {
  const router = useRouter();
  const [deleteState, deleteAction] = useActionState<
    DeleteSignupInviteState,
    FormData
  >(deleteSignupInviteAction, {});

  useEffect(() => {
    if (deleteState?.ok) {
      toast.success("تم حذف رابط الدعوة.", { id: "invite-deleted" });
      router.refresh();
    }
    if (deleteState?.error) {
      toast.error(deleteState.error, { id: "invite-delete-err" });
    }
  }, [deleteState, router]);

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط.", { id: "invite-copy-row" });
    } catch {
      toast.error("تعذّر النسخ.", { id: "invite-copy-row-err" });
    }
  };

  if (invites.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/40 px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
        لا توجد روابط دعوة محفوظة بعد. أنشئ رابطاً من القسم أعلاه ويمكنك إدارته
        من هنا لاحقاً.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-xs">
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-50 mb-1">
        روابط الدعوة الحالية
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        يمكن نسخ أي رابط أو حذف الروابط القديمة. الحذف يوقف الرابط فوراً عن العمل.
      </p>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
            <tr className="text-gray-600 dark:text-gray-400">
              <th className="px-4 py-3 font-semibold">الحالة</th>
              <th className="px-4 py-3 font-semibold">التسجيلات</th>
              <th className="px-4 py-3 font-semibold">ينتهي</th>
              <th className="px-4 py-3 font-semibold">أُنشئ</th>
              <th className="px-4 py-3 font-semibold">الرابط</th>
              <th className="px-4 py-3 font-semibold w-[200px]">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {invites.map((inv) => {
              const st = inviteStatus(inv);
              return (
                <tr key={inv.id} className="text-gray-800 dark:text-gray-200">
                  <td className="px-4 py-3">
                    <span
                      className={
                        st === "active"
                          ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : st === "expired"
                            ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                      }
                    >
                      {st === "active"
                        ? "نشط"
                        : st === "expired"
                          ? "منتهي الصلاحية"
                          : "اكتمل العدد"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 opacity-70" aria-hidden />
                      {inv.use_count} / {inv.max_uses}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3.5 h-3.5 opacity-70" aria-hidden />
                      {formatDate(inv.token_expires_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 opacity-70" aria-hidden />
                      {formatDate(inv.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[min(280px,28vw)]">
                    <div className="truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={inv.invite_url}>
                      {inv.invite_url}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(inv.invite_url)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:opacity-90"
                      >
                        <Copy className="w-4 h-4" aria-hidden />
                        نسخ
                      </button>
                      <form
                        action={deleteAction}
                        onSubmit={(e) => {
                          if (
                            !confirm(
                              "حذف هذا الرابط نهائياً؟ لن يعمل بعد الآن.",
                            )
                          ) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="invite_id" value={inv.id} />
                        <DeleteInviteSubmitButton />
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {invites.map((inv) => {
          const st = inviteStatus(inv);
          return (
            <div
              key={inv.id}
              className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <span
                  className={
                    st === "active"
                      ? "text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : st === "expired"
                        ? "text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        : "text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  }
                >
                  {st === "active"
                    ? "نشط"
                    : st === "expired"
                      ? "منتهي الصلاحية"
                      : "اكتمل العدد"}
                </span>
                <span className="text-xs text-gray-500 tabular-nums">
                  {inv.use_count} / {inv.max_uses}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all font-mono">
                {inv.invite_url}
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>ينتهي: {formatDate(inv.token_expires_at)}</div>
                <div>أُنشئ: {formatDate(inv.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(inv.invite_url)}
                  className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                >
                  <Copy className="w-4 h-4" aria-hidden />
                  نسخ
                </button>
                <form
                  action={deleteAction}
                  className="flex-1"
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        "حذف هذا الرابط نهائياً؟ لن يعمل بعد الآن.",
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="invite_id" value={inv.id} />
                  <DeleteInviteSubmitButton />
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
