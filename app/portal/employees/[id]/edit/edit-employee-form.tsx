"use client";

import { useActionState, useState } from "react";
import { Loader2, Save, User, Briefcase, FileText, Phone, StickyNote } from "lucide-react";
import { updateEmployeeAction, type ActionState } from "../../actions";
import type { Profile, UserRole } from "@/types/db";

type Company = { id: string; name_ar: string };

type Props = {
  profile: Profile;
  companies: Company[];
  canChangeRole: boolean;
  canChangeCompany: boolean;
  canSeeHrNotes: boolean;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden disabled:bg-gray-50 dark:disabled:bg-gray-900";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";
const sectionClasses =
  "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4";
const sectionTitleClasses =
  "flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4";

function Field({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className={labelClasses}>{label}</label>
      {children}
    </div>
  );
}

export function EditEmployeeForm({
  profile,
  companies,
  canChangeRole,
  canChangeCompany,
  canSeeHrNotes,
}: Props) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(profile.role);
  const isGroupWideRole = selectedRole === "md_admin";

  const [state, formAction, pending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateEmployeeAction, undefined);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={profile.id} />

      {/* ── Basic Information ─────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <User className="w-4 h-4" />
          المعلومات الأساسية
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" span2>
            <input
              name="full_name"
              required
              defaultValue={profile.full_name}
              className={inputClasses}
            />
          </Field>

          <Field label="الهاتف">
            <input
              name="phone"
              type="tel"
              defaultValue={profile.phone ?? ""}
              className={inputClasses}
              dir="ltr"
            />
          </Field>

          <Field label="تاريخ الميلاد">
            <input
              name="date_of_birth"
              type="date"
              defaultValue={profile.date_of_birth ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="الجنس">
            <select
              name="gender"
              defaultValue={profile.gender ?? ""}
              className={inputClasses}
            >
              <option value="">— اختر —</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>

          <Field label="الجنسية">
            <input
              name="nationality"
              defaultValue={profile.nationality ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="فصيلة الدم">
            <select
              name="blood_type"
              defaultValue={profile.blood_type ?? ""}
              className={inputClasses}
            >
              <option value="">— اختر —</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field label="المستوى التعليمي">
            <select
              name="education_level"
              defaultValue={profile.education_level ?? ""}
              className={inputClasses}
            >
              <option value="">— اختر —</option>
              <option value="high_school">ثانوي</option>
              <option value="diploma">دبلوم</option>
              <option value="bachelor">بكالوريوس</option>
              <option value="master">ماجستير</option>
              <option value="phd">دكتوراه</option>
              <option value="other">أخرى</option>
            </select>
          </Field>

          <Field label="العنوان" span2>
            <input
              name="address"
              defaultValue={profile.address ?? ""}
              className={inputClasses}
            />
          </Field>
        </div>
      </section>

      {/* ── Employment Details ────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Briefcase className="w-4 h-4" />
          بيانات التوظيف
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المسمى الوظيفي">
            <input
              name="job_title"
              defaultValue={profile.job_title ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="القسم / الإدارة">
            <input
              name="department"
              defaultValue={profile.department ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="تاريخ التوظيف">
            <input
              type="date"
              name="hired_at"
              defaultValue={profile.hired_at ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="نوع العقد">
            <select
              name="contract_type"
              defaultValue={profile.contract_type ?? ""}
              className={inputClasses}
            >
              <option value="">— اختر —</option>
              <option value="full_time">دوام كامل</option>
              <option value="part_time">دوام جزئي</option>
              <option value="contract">عقد مؤقت</option>
              <option value="intern">متدرب</option>
            </select>
          </Field>

          <Field label="تاريخ انتهاء العقد">
            <input
              type="date"
              name="contract_end_date"
              defaultValue={profile.contract_end_date ?? ""}
              className={inputClasses}
            />
          </Field>

          {isGroupWideRole ? (
            <p className="sm:col-span-2 text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
              مدير MD Group لا يرتبط بشركة ثابتة — يتم اختيار الشركة النشطة من لوحة الشركات.
            </p>
          ) : (
            <Field label="الشركة">
              <select
                name="company_id"
                defaultValue={profile.company_id ?? ""}
                disabled={!canChangeCompany}
                className={inputClasses}
              >
                <option value="">— بدون —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="الدور">
            <select
              name="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              disabled={!canChangeRole}
              className={inputClasses}
            >
              <option value="employee">موظف</option>
              <option value="company_manager">مدير شركة</option>
              <option value="md_admin">مدير MD Group</option>
            </select>
          </Field>

          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={profile.is_active}
                className="w-4 h-4 rounded-xs border-gray-300 dark:border-gray-600"
              />
              المستخدم نشط
            </label>
          </div>
        </div>
      </section>

      {/* ── Official Documents ────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <FileText className="w-4 h-4" />
          الوثائق الرسمية
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الرقم الوطني">
            <input
              name="national_id"
              defaultValue={profile.national_id ?? ""}
              className={inputClasses}
              dir="ltr"
            />
          </Field>

          <Field label="رقم جواز السفر">
            <input
              name="passport_number"
              defaultValue={profile.passport_number ?? ""}
              className={inputClasses}
              dir="ltr"
            />
          </Field>
        </div>
      </section>

      {/* ── Emergency Contact ─────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Phone className="w-4 h-4" />
          جهة الاتصال في الطوارئ
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم">
            <input
              name="emergency_contact_name"
              defaultValue={profile.emergency_contact_name ?? ""}
              className={inputClasses}
            />
          </Field>

          <Field label="رقم الهاتف">
            <input
              name="emergency_contact_phone"
              type="tel"
              defaultValue={profile.emergency_contact_phone ?? ""}
              className={inputClasses}
              dir="ltr"
            />
          </Field>

          <Field label="صلة القرابة">
            <input
              name="emergency_contact_relationship"
              defaultValue={profile.emergency_contact_relationship ?? ""}
              placeholder="مثال: زوجة، أخ، والد"
              className={inputClasses}
            />
          </Field>
        </div>
      </section>

      {/* ── HR Notes (managers only) ──────────────────────────── */}
      {canSeeHrNotes ? (
        <section className={sectionClasses}>
          <h2 className={sectionTitleClasses}>
            <StickyNote className="w-4 h-4" />
            ملاحظات HR (داخلية)
          </h2>
          <textarea
            name="hr_notes"
            rows={4}
            defaultValue={profile.hr_notes ?? ""}
            placeholder="ملاحظات خاصة بالـ HR — غير مرئية للموظف"
            className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden resize-none"
          />
        </section>
      ) : null}

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
            حفظ التعديلات
          </>
        )}
      </button>
    </form>
  );
}
