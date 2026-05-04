"use client";

import { useActionState, useRef, useState } from "react";
import { Pencil, X, Check, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { editProfileAction } from "./actions";
import type { UserRole } from "@/types/db";

type Company = { id: string; name_ar: string };
type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  job_title: string | null;
  is_active: boolean;
  is_super_admin: boolean;
};

type State = { error?: string; ok?: boolean };
const init: State = {};

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none";

const roleLabels: Record<UserRole, string> = {
  md_admin: "مدير عام (MD Admin)",
  company_manager: "مدير شركة",
  employee: "موظف",
};

const roleColors: Record<UserRole, string> = {
  md_admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  company_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  employee: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function UserEditForm({
  profile,
  companies,
  isSelf,
}: {
  profile: Profile;
  companies: Company[];
  isSelf: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prev: State, fd: FormData) => {
      const res = await editProfileAction(_prev, fd);
      if (res.ok) {
        toast.success("تم تحديث المستخدم");
        setIsOpen(false);
      } else if (res.error) {
        toast.error(res.error);
      }
      return res;
    },
    init,
  );

  // Collapsed row view
  if (!isOpen) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${roleColors[profile.role]}`}
        >
          {roleLabels[profile.role]}
        </span>
        {!isSelf ? (
          <button
            onClick={() => setIsOpen(true)}
            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="تعديل"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  // Edit form inline
  return (
    <form ref={formRef} action={formAction} className="mt-1">
      <input type="hidden" name="profile_id" value={profile.id} />

      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{state.error}</p>
      ) : null}

      <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 space-y-2.5 border border-gray-200 dark:border-gray-700">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            الاسم
          </label>
          <input
            type="text"
            name="full_name"
            defaultValue={profile.full_name}
            required
            className={inputCls}
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            الدور
          </label>
          <select name="role" defaultValue={profile.role} className={inputCls}>
            <option value="employee">موظف</option>
            <option value="company_manager">مدير شركة</option>
            <option value="md_admin">مدير عام (MD Admin)</option>
          </select>
        </div>

        {/* Company */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            الشركة المُعيَّن إليها
          </label>
          <select
            name="company_id"
            defaultValue={profile.company_id ?? ""}
            className={inputCls}
          >
            <option value="">— بدون شركة (مدير عام) —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </div>

        {/* Job title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            المسمى الوظيفي
          </label>
          <input
            type="text"
            name="job_title"
            defaultValue={profile.job_title ?? ""}
            placeholder="اختياري..."
            className={inputCls}
          />
        </div>

        {/* Active */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            الحساب نشط
          </label>
          <select
            name="is_active"
            defaultValue={String(profile.is_active)}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none"
          >
            <option value="true">نعم</option>
            <option value="false">لا</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {isPending ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            إلغاء
          </button>
        </div>
      </div>
    </form>
  );
}
