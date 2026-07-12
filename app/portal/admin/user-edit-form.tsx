"use client";

import { useActionState, useRef, useState } from "react";
import { Pencil, X, Check, ChevronDown, KeyRound, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { editProfileAction, updateUserAuthAction } from "./actions";
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
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-hidden";

const roleLabels: Record<UserRole, string> = {
  md_admin: "مدير MD Group",
  company_manager: "مدير شركة",
  employee: "موظف",
  owner: "مالك",
};

const roleColors: Record<UserRole, string> = {
  md_admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  company_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  employee: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function UserEditForm({
  profile,
  companies,
  isSelf,
  email,
}: {
  profile: Profile;
  companies: Company[];
  isSelf: boolean;
  email: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(profile.role);
  const formRef = useRef<HTMLFormElement>(null);
  const authFormRef = useRef<HTMLFormElement>(null);

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

  const [authState, authFormAction, isAuthPending] = useActionState(
    async (_prev: State, fd: FormData) => {
      const res = await updateUserAuthAction(_prev, fd);
      if (res.ok) {
        toast.success("تم تحديث بيانات الدخول");
        setShowAuth(false);
        authFormRef.current?.reset();
      } else if (res.error) {
        toast.error(res.error);
      }
      return res;
    },
    init,
  );

  const isGroupWideRole = selectedRole === "md_admin" || selectedRole === "owner";

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

  return (
    <div className="mt-1 space-y-2">
      {/* Profile edit form */}
      <form ref={formRef} action={formAction}>
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
            <select
              name="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className={inputCls}
            >
              <option value="employee">موظف</option>
              <option value="company_manager">مدير شركة</option>
              <option value="md_admin">مدير MD Group</option>
              <option value="owner">مالك (عرض فقط)</option>
            </select>
          </div>

          {/* Company — not applicable for group-wide roles */}
          {isGroupWideRole ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
              مدير MD Group والمالك لا يرتبطان بشركة ثابتة — يتم اختيار الشركة النشطة من لوحة الشركات.
            </p>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                الشركة المُعيَّن إليها
              </label>
              <select
                name="company_id"
                defaultValue={profile.company_id ?? ""}
                className={inputCls}
              >
                <option value="">— بدون شركة —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden"
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
              onClick={() => { setIsOpen(false); setShowAuth(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              إلغاء
            </button>
          </div>
        </div>
      </form>

      {/* Auth credentials section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAuth((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            تغيير البريد الإلكتروني / كلمة المرور
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAuth ? "rotate-180" : ""}`} />
        </button>

        {showAuth ? (
          <form ref={authFormRef} action={authFormAction} className="p-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
            <input type="hidden" name="auth_profile_id" value={profile.id} />

            {authState?.error ? (
              <p className="text-xs text-red-600 dark:text-red-400">{authState.error}</p>
            ) : null}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                البريد الإلكتروني الجديد
              </label>
              <input
                type="email"
                name="new_email"
                placeholder={email || "البريد الحالي..."}
                className={inputCls}
              />
              {email ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  الحالي: {email}
                </p>
              ) : null}
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3" />
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                name="new_password"
                placeholder="اتركها فارغة إن لم تريد التغيير"
                minLength={6}
                className={inputCls}
              />
            </div>

            <button
              type="submit"
              disabled={isAuthPending}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 disabled:opacity-60 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              {isAuthPending ? "جارٍ التحديث..." : "تحديث بيانات الدخول"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
