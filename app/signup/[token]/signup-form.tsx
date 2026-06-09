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
  submitEmployeeSignupAction,
  type SignupSubmitState,
} from "./actions";
import type { SignupAppearance } from "./signup-appearance";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Field({
  label,
  required,
  appearance,
  children,
}: {
  label: string;
  required?: boolean;
  appearance: SignupAppearance;
  children: React.ReactNode;
}) {
  const dark = appearance === "dark";
  return (
    <div>
      <label
        className={cn(
          "block text-sm font-semibold mb-2",
          dark ? "text-neutral-200" : "text-gray-800",
        )}
      >
        {label}{" "}
        {required ? (
          <span className="text-red-500 dark:text-red-400">*</span>
        ) : (
          <span
            className={cn(
              "font-normal text-xs",
              dark ? "text-neutral-500" : "text-gray-500",
            )}
          >
            (اختياري)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  appearance,
}: {
  title: string;
  appearance: SignupAppearance;
}) {
  const dark = appearance === "dark";
  return (
    <div className="flex items-center gap-3 pt-2">
      <div
        className={cn("h-px flex-1", dark ? "bg-neutral-800" : "bg-gray-200")}
      />
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-widest",
          dark ? "text-amber-400/80" : "text-amber-700",
        )}
      >
        {title}
      </span>
      <div
        className={cn("h-px flex-1", dark ? "bg-neutral-800" : "bg-gray-200")}
      />
    </div>
  );
}

function inputClasses(appearance: SignupAppearance, iconPad?: boolean) {
  const dark = appearance === "dark";
  return cn(
    "w-full py-3 border-2 rounded-xl outline-none transition",
    iconPad ? "pr-12 pl-4" : "px-4",
    dark
      ? "border-neutral-700 bg-neutral-950 text-white placeholder:text-neutral-500 focus:border-amber-500/80 focus:ring-4 focus:ring-amber-500/10"
      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-amber-600 focus:ring-4 focus:ring-amber-500/15",
  );
}

function SubmitButton({ appearance }: { appearance: SignupAppearance }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        appearance === "dark"
          ? "bg-gradient-to-r from-amber-600 to-amber-700 text-black shadow-amber-900/40 hover:shadow-xl hover:-translate-y-0.5"
          : "bg-gradient-to-r from-amber-500 to-amber-600 text-gray-900 shadow-amber-800/25 hover:shadow-xl hover:-translate-y-0.5",
      )}
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

export function EmployeeSignupForm({
  token,
  companyNameAr,
  appearance,
}: {
  token: string;
  companyNameAr: string;
  appearance: SignupAppearance;
}) {
  const [state, formAction] = useActionState<SignupSubmitState, FormData>(
    submitEmployeeSignupAction,
    {},
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("تم استلام طلبك. سيتم مراجعته من قبل الإدارة.", {
        id: "signup-ok",
      });
    }
  }, [state?.ok]);

  const dark = appearance === "dark";

  if (state?.ok) {
    return (
      <div
        className={cn(
          "rounded-2xl border p-8 text-center space-y-4",
          dark
            ? "border-amber-500/30 bg-black/60"
            : "border-amber-200 bg-white shadow-inner",
        )}
      >
        <div
          className={cn(
            "inline-flex h-14 w-14 items-center justify-center rounded-full",
            dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700",
          )}
        >
          <CircleCheck className="w-7 h-7" />
        </div>
        <h2
          className={cn(
            "text-xl font-bold",
            dark ? "text-white" : "text-gray-900",
          )}
        >
          تم الإرسال بنجاح
        </h2>
        <p
          className={cn(
            "text-sm leading-relaxed",
            dark ? "text-neutral-400" : "text-gray-600",
          )}
        >
          تم استلام بياناتك ضمن شركة{" "}
          <span
            className={cn(
              "font-semibold",
              dark ? "text-amber-200/90" : "text-amber-800",
            )}
          >
            {companyNameAr}
          </span>
          . سيتواصل معك المسؤول بعد المراجعة.
        </p>
      </div>
    );
  }

  const iconMuted = dark ? "text-neutral-500" : "text-gray-400";

  return (
    <form action={formAction} className="space-y-5" dir="rtl">
      <input type="hidden" name="token" value={token} />

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
        <div
          className={cn(
            "flex items-start gap-3 p-4 rounded-xl border",
            dark
              ? "bg-red-950/50 border-red-800/60"
              : "bg-red-50 border-red-200",
          )}
        >
          <CircleAlert
            className={cn(
              "w-5 h-5 flex-shrink-0 mt-0.5",
              dark ? "text-red-400" : "text-red-600",
            )}
          />
          <p className={cn("text-sm", dark ? "text-red-200" : "text-red-800")}>
            {state.error}
          </p>
        </div>
      ) : null}

      <SectionTitle title="البيانات الشخصية" appearance={appearance} />

      <Field label="الاسم الكامل" required appearance={appearance}>
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
            className={inputClasses(appearance, true)}
            placeholder="الاسم الثلاثي"
          />
        </div>
      </Field>

      <Field
        label="رقم الوظيفي (رقم البصمة)"
        required
        appearance={appearance}
      >
        <p
          className={cn(
            "text-xs mb-2 leading-relaxed",
            dark ? "text-neutral-500" : "text-gray-500",
          )}
        >
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
            className={inputClasses(appearance, true)}
            placeholder="مثال: 4521"
            autoComplete="off"
          />
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="رقم الهاتف" required appearance={appearance}>
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
              className={cn(inputClasses(appearance, true), "tracking-wide")}
              placeholder="09xxxxxxxx"
            />
          </div>
        </Field>

        <Field label="رقم الجواز أو الرخصة" required appearance={appearance}>
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
              className={inputClasses(appearance, true)}
              placeholder="A1234567"
            />
          </div>
        </Field>
      </div>

      <SectionTitle title="صورة جواز السفر أو الرخصة " appearance={appearance} />

      <Field label="رفع صورة الجواز أو الرخصة" required appearance={appearance}>
        <p
          className={cn(
            "text-xs mb-2 leading-relaxed",
            dark ? "text-neutral-500" : "text-gray-500",
          )}
        >
          صورة واضحة للجواز أو الرخصة — JPG أو PNG أو WebP،
          بحد أقصى 8 ميجابايت.
        </p>
        <input
          type="file"
          name="passport_image"
          required
          accept="image/jpeg,image/png,image/webp"
          className={cn(
            inputClasses(appearance),
            "file:rounded-lg file:border-0 file:py-2 file:px-3 file:mr-3 file:bg-amber-600 file:text-black file:text-sm file:font-semibold cursor-pointer",
          )}
        />
      </Field>

      <Field label="الرقم الوطني" appearance={appearance}>
        <div className="relative">
          <CreditCard
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="national_id"
            className={inputClasses(appearance, true)}
            placeholder="123456789"
          />
        </div>
      </Field>

      <Field label="تاريخ الميلاد" required appearance={appearance}>
        <DateOfBirthInput
          hintClassName={dark ? "text-neutral-500" : "text-gray-500"}
          inputClassName={cn(inputClasses(appearance), "tracking-wide")}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="الجنس" appearance={appearance}>
          <select
            name="gender"
            className={cn(inputClasses(appearance), "appearance-none")}
          >
            <option value="">— اختر —</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </Field>

        <Field label="فصيلة الدم" appearance={appearance}>
          <select
            name="blood_type"
            className={cn(inputClasses(appearance), "appearance-none")}
          >
            <option value="">— اختر —</option>
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="الجنسية" appearance={appearance}>
          <div className="relative">
            <Globe
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="nationality"
              className={inputClasses(appearance, true)}
              placeholder="ليبي"
            />
          </div>
        </Field>
      </div>

      <Field label="العنوان" appearance={appearance}>
        <div className="relative">
          <MapPin
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
              iconMuted,
            )}
          />
          <input
            name="address"
            className={inputClasses(appearance, true)}
            placeholder="المدينة، الحي"
          />
        </div>
      </Field>

      <SectionTitle title="جهة الاتصال في الطوارئ" appearance={appearance} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="الاسم" required appearance={appearance}>
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
              className={inputClasses(appearance, true)}
              placeholder="اسم كامل"
            />
          </div>
        </Field>

        <Field label="رقم الهاتف" required appearance={appearance}>
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
              className={cn(inputClasses(appearance, true), "tracking-wide")}
              placeholder="09xxxxxxxx"
            />
          </div>
        </Field>
      </div>

      <Field label="صلة القرابة" required appearance={appearance}>
        <input
          name="emergency_contact_relationship"
          required
          className={inputClasses(appearance)}
          placeholder="مثال: زوجة، أخ، والد"
        />
      </Field>

      <SectionTitle title="البيانات الوظيفية" appearance={appearance} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="المسمى الوظيفي" appearance={appearance}>
          <div className="relative">
            <Briefcase
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                iconMuted,
              )}
            />
            <input
              name="job_title"
              className={inputClasses(appearance, true)}
              placeholder="موظف مبيعات"
            />
          </div>
        </Field>

        <Field label="الفرع (المحل التابع له)" required appearance={appearance}>
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
              className={inputClasses(appearance, true)}
              placeholder=" فرع المحل"
            />
          </div>
        </Field>
      </div>

      <SubmitButton appearance={appearance} />


    </form>
  );
}
