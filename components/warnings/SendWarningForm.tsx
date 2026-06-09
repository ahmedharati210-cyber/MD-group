"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Send, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { sendWarningAction } from "@/app/portal/warnings/actions";
import { syncPortalAppBadge } from "@/lib/push/sync-app-badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/db";

type Engineer = { id: string; full_name: string };
type Manager = { id: string; full_name: string; role: UserRole };
type Company = { id: string; name_ar: string };
type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls =
  "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";

const managerRoleLabel: Partial<Record<UserRole, string>> = {
  company_manager: "مدير شركة",
  md_admin: "MD Admin",
};

type Props = {
  engineers: Engineer[];
  managers?: Manager[];
  senderShellCompanyId?: string;
  canBroadcast: boolean;
  companies?: Company[];
};

export function SendWarningForm({
  engineers,
  managers = [],
  senderShellCompanyId = "",
  canBroadcast,
  companies = [],
}: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(sendWarningAction, init);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broadcastCompany, setBroadcastCompany] = useState("");
  const [kind, setKind] = useState<"warning" | "notification">("warning");
  const [messageFieldKey, setMessageFieldKey] = useState(0);

  useEffect(() => {
    if (!state?.ok) return;
    setSelected(new Set());
    setBroadcastCompany("");
    setMessageFieldKey((k) => k + 1);
    toast.success("تم الإرسال بنجاح.", { id: "warning-sent" });
    router.refresh();
    void syncPortalAppBadge();
  }, [state, router]);

  const allRecipients = [...engineers, ...managers];
  const allIds = allRecipients.map((r) => r.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = selected.size > 0;

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit =
    someChecked || (canBroadcast && broadcastCompany.trim().length > 0);

  function renderRecipientList(items: { id: string; full_name: string; role?: UserRole }[]) {
    if (items.length === 0) return null;

    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 max-h-52 overflow-y-auto">
        {items.map((item) => (
          <label
            key={item.id}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
              selected.has(item.id)
                ? "bg-amber-50 dark:bg-amber-900/10"
                : "bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50",
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggleOne(item.id)}
              className="w-4 h-4 rounded-xs accent-amber-600"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">
              {item.full_name}
            </span>
            {item.role && item.role !== "employee" ? (
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {managerRoleLabel[item.role] ?? item.role}
              </span>
            ) : null}
          </label>
        ))}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.ok ? (
        <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-300">
          تم الإرسال بنجاح. يمكنك إرسال رسالة جديدة أدناه.
        </div>
      ) : null}

      {state?.error ? (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <input type="hidden" name="kind" value={kind} />
      {senderShellCompanyId ? (
        <input type="hidden" name="sender_shell_company_id" value={senderShellCompanyId} />
      ) : null}

      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          نوع الإرسال
        </span>
        <div
          className="flex gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          role="group"
          aria-label="نوع الإرسال"
        >
          <button
            type="button"
            onClick={() => setKind("warning")}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              kind === "warning"
                ? "bg-white dark:bg-gray-900 text-red-700 dark:text-red-300 shadow-xs ring-1 ring-red-200 dark:ring-red-800"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80",
            )}
          >
            <TriangleAlert className="w-4 h-4 shrink-0" />
            إنذار
          </button>
          <button
            type="button"
            onClick={() => setKind("notification")}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              kind === "notification"
                ? "bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-300 shadow-xs ring-1 ring-orange-200 dark:ring-orange-800"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80",
            )}
          >
            <Bell className="w-4 h-4 shrink-0" />
            إشعار
          </button>
        </div>
      </div>

      {[...selected].map((id) => (
        <input key={id} type="hidden" name="target_profile_ids" value={id} />
      ))}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            الموجه إلى
          </label>
          {allIds.length > 1 ? (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              {allChecked ? "إلغاء الكل" : "تحديد الكل"}
            </button>
          ) : null}
        </div>

        {allRecipients.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            لا يوجد مستلمون متاحون.
          </p>
        ) : (
          <div className="space-y-4">
            {engineers.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  الموظفون
                </p>
                {renderRecipientList(engineers)}
              </div>
            ) : null}
            {managers.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  المديرون
                </p>
                {renderRecipientList(managers)}
              </div>
            ) : null}
          </div>
        )}

        {someChecked ? (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            {selected.size === allIds.length
              ? "جميع المستلمين محددون"
              : `${selected.size} مستلم محدد`}
          </p>
        ) : null}
      </div>

      {canBroadcast ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            بث عام — الشركة المستهدفة
          </label>
          <select
            name="warning_company_id"
            value={broadcastCompany}
            onChange={(e) => setBroadcastCompany(e.target.value)}
            className={inputCls}
          >
            <option value="">— بدون بث عام —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            إذا اخترت شركة هنا سيُرسل الإشعار لجميع موظفيها بغض النظر عن التحديد أعلاه.
          </p>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          نص الرسالة *
        </label>
        <textarea
          key={messageFieldKey}
          name="message"
          rows={3}
          required
          placeholder="اكتب نص الإنذار أو الإشعار..."
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors",
          kind === "warning"
            ? "bg-red-600 hover:bg-red-700"
            : "bg-orange-600 hover:bg-orange-700",
        )}
      >
        <Send className="w-4 h-4" />
        {isPending ? "جارٍ الإرسال..." : "إرسال"}
      </button>
    </form>
  );
}
