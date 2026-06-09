"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import toast from "react-hot-toast";
import {
  CircleAlert,
  Loader2,
  Phone,
  User,
  BookOpen,
  CreditCard,
  MapPin,
  Briefcase,
  Globe,
  CircleCheck,
  Store,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DateOfBirthInput } from "@/components/forms/date-of-birth-input";
import {
  submitOpenDolceSignupAction,
  type JoinSubmitState,
} from "./actions";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">
        {label}{" "}
        {required ? (
          <span className="text-red-500">*</span>
        ) : (
          <span className="font-normal text-xs text-gray-500 dark:text-gray-400">
            (اختياري)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
        {title}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

function inputClasses(iconPad?: boolean) {
  return cn(
    "w-full py-3 border-2 rounded-xl outline-hidden transition",
    iconPad ? "pr-12 pl-4" : "px-4",
    "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15",
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          جارٍ الإرسال...
        </>
      ) : (
        "إرسال الطلب"
      )}
    </button>
  );
}

export function JoinForm({ companyNameAr }: { companyNameAr: string }) {
  const [state, formAction] = useActionState<JoinSubmitState, FormData>(
    submitOpenDolceSignupAction,
    {},
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("تم استلام طلبك. سيتم مراجعته من قبل الإدارة.", {
        id: "join-ok",
      });
    }
  }, [state?.ok]);

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900 p-8 text-center space-y-4 shadow-xs">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
          <CircleCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          تم الإرسال بنجاح
        </h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          تم استلام بياناتك ضمن شركة{" "}
          <span className="font-semibold text-primary-700 dark:text-primary-300">
            {companyNameAr}
          </span>
          . سيتواصل معك المسؤول بعد المراجعة.
        </p>
      </div>
    );
  }

  const iconMuted = "text-gray-400 dark:text-gray-500";

  return (
    <form action={formAction} className="space-y-5" dir="rtl">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state?.error ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800">
          <CircleAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
        </div>
      ) : null}

      <SectionTitle title="البيانات الشخصية" />

      <Field label="الاسم الكامل" required>
        <div className="relative">
          <User
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="full_name"
            required
            autoComplete="name"
            className={inputClasses(true)}
            placeholder="الاسم الثلاثي"
          />
        </div>
      </Field>

      <Field label="رقم الوظيفي (رقم البصمة)" required>
        <p className="text-xs mb-2 leading-relaxed text-gray-500 dark:text-gray-400">
          الرقم المعتمد في نظام الحضور والإنصراف
        </p>
        <div className="relative">
          <Hash
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="external_employee_number"
            required
            className={inputClasses(true)}
            placeholder="مثال: 4521"
            autoComplete="off"
          />
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="رقم الهاتف" required>
          <div className="relative">
            <Phone
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="phone"
              type="tel"
              inputMode="numeric"
              required
              maxLength={10}
              pattern="09\d{8}"
              title="10 أرقام تبدأ بـ 09"
              autoComplete="tel"
              dir="ltr"
              className={cn(inputClasses(true), "tracking-wide")}
              placeholder="09xxxxxxxx"
            />
          </div>
        </Field>

        <Field label="رقم الجواز أو الرخصة" required>
          <div className="relative">
            <BookOpen
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="passport_number"
              required
              className={inputClasses(true)}
              placeholder="A1234567"
            />
          </div>
        </Field>
      </div>

      <SectionTitle title="صورة جواز السفر أو الرخصة" />

      <Field label="رفع صورة الجواز أو الرخصة" required>
        <p className="text-xs mb-2 leading-relaxed text-gray-500 dark:text-gray-400">
          صورة واضحة للجواز أو الرخصة — JPG أو PNG أو WebP، بحد أقصى 8 ميجابايت.
        </p>
        <input
          type="file"
          name="passport_image"
          required
          accept="image/jpeg,image/png,image/webp"
          className={cn(
            inputClasses(),
            "file:rounded-lg file:border-0 file:py-2 file:px-3 file:mr-3 file:bg-primary-600 file:text-white file:text-sm file:font-semibold cursor-pointer",
          )}
        />
      </Field>

      <Field label="الرقم الوطني">
        <div className="relative">
          <CreditCard
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="national_id"
            className={inputClasses(true)}
            placeholder="123456789"
          />
        </div>
      </Field>

      <Field label="تاريخ الميلاد" required>
        <DateOfBirthInput
          inputClassName={cn(inputClasses(), "tracking-wide")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="الجنس">
          <select name="gender" className={cn(inputClasses(), "appearance-none")}>
            <option value="">— اختر —</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </Field>

        <Field label="فصيلة الدم">
          <select
            name="blood_type"
            className={cn(inputClasses(), "appearance-none")}
          >
            <option value="">— اختر —</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="الجنسية">
          <div className="relative">
            <Globe
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="nationality"
              className={inputClasses(true)}
              placeholder="ليبي"
            />
          </div>
        </Field>
      </div>

      <Field label="العنوان">
        <div className="relative">
          <MapPin
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="address"
            className={inputClasses(true)}
            placeholder="المدينة، الحي"
          />
        </div>
      </Field>

      <SectionTitle title="جهة الاتصال في الطوارئ" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="الاسم" required>
          <div className="relative">
            <User
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="emergency_contact_name"
              required
              autoComplete="name"
              className={inputClasses(true)}
              placeholder="اسم كامل"
            />
          </div>
        </Field>

        <Field label="رقم الهاتف" required>
          <div className="relative">
            <Phone
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="emergency_contact_phone"
              type="tel"
              inputMode="numeric"
              required
              maxLength={10}
              pattern="09\d{8}"
              title="10 أرقام تبدأ بـ 09"
              dir="ltr"
              className={cn(inputClasses(true), "tracking-wide")}
              placeholder="09xxxxxxxx"
            />
          </div>
        </Field>
      </div>

      <Field label="صلة القرابة" required>
        <input
          name="emergency_contact_relationship"
          required
          className={inputClasses()}
          placeholder="مثال: زوجة، أخ، والد"
        />
      </Field>

      <SectionTitle title="البيانات الوظيفية" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="المسمى الوظيفي">
          <div className="relative">
            <Briefcase
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="job_title"
              className={inputClasses(true)}
              placeholder="موظف مبيعات"
            />
          </div>
        </Field>

        <Field label="الفرع (المحل التابع له)" required>
          <div className="relative">
            <Store
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="branch"
              required
              className={inputClasses(true)}
              placeholder="فرع المحل"
            />
          </div>
        </Field>
      </div>

      <SubmitButton />
    </form>
  );
}
