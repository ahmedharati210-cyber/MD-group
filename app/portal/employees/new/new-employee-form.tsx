"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, Loader2, User, Briefcase, FileText, Phone } from "lucide-react";
import { createEmployeeAction, type ActionState } from "../actions";
import type { UserRole } from "@/types/db";

type Company = { id: string; name_ar: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          جارٍ الحفظ...
        </>
      ) : (
        "إضافة الموظف"
      )}
    </button>
  );
}

type Props = {
  companies: Company[];
  currentRole: UserRole;
  currentCompanyId: string | null;
};

const inputClasses =
  "w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";
const labelClasses =
  "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5";
const sectionClasses =
  "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4";
const sectionTitleClasses =
  "flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4";

function Field({
  label,
  hint,
  span2 = false,
  children,
}: {
  label: string;
  hint?: string;
  span2?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className={labelClasses}>{label}</label>
      {children}
      {hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClasses} />;
}

export function NewEmployeeForm({
  companies,
  currentRole,
  currentCompanyId,
}: Props) {
  const [state, action] = useActionState<ActionState, FormData>(
    createEmployeeAction,
    {},
  );

  const isManager = currentRole === "company_manager";
  const lockedCompanyId = isManager ? (currentCompanyId ?? "") : "";

  return (
    <form action={action} className="space-y-5">
      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <CircleAlert className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      {/* ── Account Credentials ───────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <User className="w-4 h-4" />
          بيانات الحساب
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" span2>
            <Input name="full_name" required />
          </Field>
          <Field
            label="البريد الإلكتروني"
            hint="اختياري — سيُولَّد تلقائياً إذا تُرك فارغاً"
          >
            <Input name="email" type="email" />
          </Field>
          <Field
            label="كلمة المرور المبدئية"
            hint="اختياري — سيُولَّد تلقائياً إذا تُرك فارغاً (8 أحرف على الأقل إذا أدخلتها)"
          >
            <Input name="password" type="password" />
          </Field>
        </div>
      </section>

      {/* ── Personal Information ──────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <User className="w-4 h-4" />
          المعلومات الشخصية
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="رقم الهاتف">
            <Input name="phone" type="tel" dir="ltr" />
          </Field>
          <Field label="تاريخ الميلاد">
            <Input name="date_of_birth" type="date" />
          </Field>
          <Field label="الجنس">
            <select name="gender" className={inputClasses}>
              <option value="">— اختر —</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>
          <Field label="الجنسية">
            <Input name="nationality" />
          </Field>
          <Field label="فصيلة الدم">
            <select name="blood_type" className={inputClasses}>
              <option value="">— اختر —</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="المستوى التعليمي">
            <select name="education_level" className={inputClasses}>
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
            <Input name="address" />
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
            <Input name="job_title" placeholder="محاسب، مهندس..." />
          </Field>
          <Field label="القسم / الإدارة">
            <Input name="department" />
          </Field>
          <Field label="تاريخ التوظيف">
            <Input name="hired_at" type="date" />
          </Field>
          <Field label="نوع العقد">
            <select name="contract_type" className={inputClasses}>
              <option value="">— اختر —</option>
              <option value="full_time">دوام كامل</option>
              <option value="part_time">دوام جزئي</option>
              <option value="contract">عقد مؤقت</option>
              <option value="intern">متدرب</option>
            </select>
          </Field>
          <Field label="تاريخ انتهاء العقد">
            <Input name="contract_end_date" type="date" />
          </Field>

          <div>
            <label className={labelClasses}>الشركة</label>
            <select
              name="company_id"
              required
              disabled={isManager}
              defaultValue={lockedCompanyId || undefined}
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

          {!isManager ? (
            <div>
              <label className={labelClasses}>الدور</label>
              <select name="role" defaultValue="employee" className={inputClasses}>
                <option value="employee">موظف</option>
                <option value="company_manager">مدير شركة</option>
              </select>
            </div>
          ) : (
            <input type="hidden" name="role" value="employee" />
          )}
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
            <Input name="national_id" dir="ltr" />
          </Field>
          <Field label="رقم جواز السفر">
            <Input name="passport_number" dir="ltr" />
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
            <Input name="emergency_contact_name" />
          </Field>
          <Field label="رقم الهاتف">
            <Input name="emergency_contact_phone" type="tel" dir="ltr" />
          </Field>
          <Field label="صلة القرابة">
            <Input
              name="emergency_contact_relationship"
              placeholder="مثال: زوجة، أخ، والد"
            />
          </Field>
        </div>
      </section>

      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}
