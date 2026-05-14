"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, User, Briefcase, FileText, Phone } from "lucide-react";
import { updateEmployeeDirectoryAction, type ActionState } from "../../actions";
import type { EmployeeDirectoryRow } from "@/types/db";

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
        "حفظ التعديلات"
      )}
    </button>
  );
}

type Props = {
  row: EmployeeDirectoryRow;
  companies: Company[];
  canChangeCompany: boolean;
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

export function EditDirectoryForm({ row, companies, canChangeCompany }: Props) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateEmployeeDirectoryAction,
    {},
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={row.id} />
      {!canChangeCompany ? (
        <input type="hidden" name="company_id" value={row.company_id} />
      ) : null}

      {state?.error ? (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      ) : null}

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <User className="w-4 h-4" />
          الهوية والشركة
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" span2>
            <Input name="full_name" required defaultValue={row.full_name} />
          </Field>
          <Field label="بريد للمراسلة (اختياري)" span2>
            <Input
              name="contact_email"
              type="email"
              dir="ltr"
              autoComplete="off"
              defaultValue={row.contact_email ?? ""}
            />
          </Field>
          <Field label="نشط في السجل" span2>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={row.is_active}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">الموظف نشط</span>
            </label>
          </Field>
        </div>
      </section>

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <User className="w-4 h-4" />
          المعلومات الشخصية
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="رقم الهاتف">
            <Input name="phone" type="tel" dir="ltr" defaultValue={row.phone ?? ""} />
          </Field>
          <Field label="تاريخ الميلاد">
            <Input
              name="date_of_birth"
              type="date"
              defaultValue={row.date_of_birth?.slice(0, 10) ?? ""}
            />
          </Field>
          <Field label="الجنس">
            <select name="gender" className={inputClasses} defaultValue={row.gender ?? ""}>
              <option value="">— اختر —</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>
          <Field label="الجنسية">
            <Input name="nationality" defaultValue={row.nationality ?? ""} />
          </Field>
          <Field label="فصيلة الدم">
            <select name="blood_type" className={inputClasses} defaultValue={row.blood_type ?? ""}>
              <option value="">— اختر —</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المستوى التعليمي">
            <select
              name="education_level"
              className={inputClasses}
              defaultValue={row.education_level ?? ""}
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
            <Input name="address" defaultValue={row.address ?? ""} />
          </Field>
        </div>
      </section>

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Briefcase className="w-4 h-4" />
          بيانات التوظيف
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المسمى الوظيفي">
            <Input name="job_title" defaultValue={row.job_title ?? ""} />
          </Field>
          <Field label="القسم / الإدارة">
            <Input name="department" defaultValue={row.department ?? ""} />
          </Field>
          <Field label="تاريخ التوظيف">
            <Input name="hired_at" type="date" defaultValue={row.hired_at?.slice(0, 10) ?? ""} />
          </Field>
          <Field label="نوع العقد">
            <select name="contract_type" className={inputClasses} defaultValue={row.contract_type ?? ""}>
              <option value="">— اختر —</option>
              <option value="full_time">دوام كامل</option>
              <option value="part_time">دوام جزئي</option>
              <option value="contract">عقد مؤقت</option>
              <option value="intern">متدرب</option>
            </select>
          </Field>
          <Field label="تاريخ انتهاء العقد">
            <Input
              name="contract_end_date"
              type="date"
              defaultValue={row.contract_end_date?.slice(0, 10) ?? ""}
            />
          </Field>

          {canChangeCompany ? (
            <div className="sm:col-span-2">
              <label className={labelClasses}>الشركة</label>
              <select
                name="company_id"
                required
                defaultValue={row.company_id}
                className={inputClasses}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ar}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <FileText className="w-4 h-4" />
          الوثائق الرسمية
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الرقم الوطني">
            <Input name="national_id" dir="ltr" defaultValue={row.national_id ?? ""} />
          </Field>
          <Field label="رقم جواز السفر">
            <Input name="passport_number" dir="ltr" defaultValue={row.passport_number ?? ""} />
          </Field>
        </div>
      </section>

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Phone className="w-4 h-4" />
          جهة الاتصال في الطوارئ
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الاسم">
            <Input name="emergency_contact_name" defaultValue={row.emergency_contact_name ?? ""} />
          </Field>
          <Field label="رقم الهاتف">
            <Input
              name="emergency_contact_phone"
              type="tel"
              dir="ltr"
              defaultValue={row.emergency_contact_phone ?? ""}
            />
          </Field>
          <Field label="صلة القرابة">
            <Input
              name="emergency_contact_relationship"
              defaultValue={row.emergency_contact_relationship ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <FileText className="w-4 h-4" />
          ملاحظات الموارد البشرية
        </h2>
        <Field label="ملاحظات داخلية (اختياري)" span2>
          <textarea
            name="hr_notes"
            rows={3}
            className={inputClasses}
            defaultValue={row.hr_notes ?? ""}
          />
        </Field>
      </section>

      <div className="pt-2">
        <Submit />
      </div>
    </form>
  );
}
