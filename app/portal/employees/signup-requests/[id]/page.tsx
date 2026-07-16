import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  FileText,
  ImageIcon,
  Phone,
  User,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canAccessDolceEmployeeSignup } from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { formatDate } from "@/lib/utils";
import { SignupRequestActions } from "../signup-request-actions";

export const metadata = { title: "مراجعة طلب التوظيف" };

function genderLabel(v: string | null) {
  if (v === "male" || v === "ذكر") return "ذكر";
  if (v === "female" || v === "أنثى") return "أنثى";
  return "—";
}

function statusLabel(status: string) {
  if (status === "pending") return "قيد المراجعة";
  if (status === "approved") return "مقبول";
  if (status === "rejected") return "مرفوض";
  return status;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        مقبول
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        مرفوض
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      قيد المراجعة
    </span>
  );
}

export default async function SignupRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const shellId = await getShellCompanyIdForProfile(current.profile);

  if (!(await canAccessDolceEmployeeSignup(current.profile, shellId))) {
    redirect("/portal");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from("employee_signup_requests")
    .select("*, companies ( name_ar )")
    .eq("id", id)
    .maybeSingle();

  if (!row) notFound();

  if (
    current.profile.role === "company_manager" &&
    row.company_id !== current.profile.company_id
  ) {
    notFound();
  }

  const companiesRaw = row.companies as
    | { name_ar: string }
    | { name_ar: string }[]
    | null;
  const companyName = Array.isArray(companiesRaw)
    ? companiesRaw[0]?.name_ar
    : companiesRaw?.name_ar;

  const isPending = row.status === "pending";

  return (
    <div>
      <Link
        href="/portal/employees/signup-requests"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى طلبات التوظيف
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <PageHeader
          title={row.full_name ?? "طلب توظيف"}
          description={
            [companyName, row.job_title].filter(Boolean).join(" — ") ||
            undefined
          }
        />
        <StatusBadge status={row.status} />
      </div>

      <div className="space-y-4">
        <ProfileSection title="المعلومات الشخصية" icon={User}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الاسم الكامل" value={row.full_name ?? "—"} />
            <InfoRow label="الهاتف" value={row.phone ?? "—"} />
            <InfoRow label="الجنس" value={genderLabel(row.gender)} />
            <InfoRow
              label="تاريخ الميلاد"
              value={formatDate(row.date_of_birth) || "—"}
            />
            <InfoRow label="الجنسية" value={row.nationality ?? "—"} />
            <InfoRow label="فصيلة الدم" value={row.blood_type ?? "—"} />
            <InfoRow label="البريد" value={row.email ?? "—"} />
            <InfoRow label="العنوان" value={row.address ?? "—"} span2 />
          </div>
        </ProfileSection>

        <ProfileSection title="بيانات التوظيف" icon={Briefcase}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الشركة" value={companyName ?? "—"} />
            <InfoRow
              label="رقم الموظف (خارجي)"
              value={row.external_employee_number ?? "—"}
            />
            <InfoRow label="المسمى الوظيفي" value={row.job_title ?? "—"} />
            <InfoRow label="الفرع / القسم" value={row.department ?? "—"} />
          </div>
        </ProfileSection>

        <ProfileSection title="الوثائق الرسمية" icon={FileText}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الرقم الوطني" value={row.national_id ?? "—"} />
            <InfoRow
              label="رقم جواز السفر"
              value={row.passport_number ?? "—"}
            />
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 col-span-2 md:col-span-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                صورة الجواز
              </div>
              {row.passport_image_path ? (
                <Link
                  href={`/api/portal/employee-signup/passports/${row.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-2"
                >
                  <ImageIcon className="w-4 h-4 shrink-0" aria-hidden />
                  عرض الصورة
                </Link>
              ) : (
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  —
                </div>
              )}
            </div>
          </div>
        </ProfileSection>

        <ProfileSection title="جهة الاتصال في الطوارئ" icon={Phone}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow
              label="الاسم"
              value={row.emergency_contact_name ?? "—"}
            />
            <InfoRow
              label="رقم الهاتف"
              value={row.emergency_contact_phone ?? "—"}
            />
            <InfoRow
              label="صلة القرابة"
              value={row.emergency_contact_relationship ?? "—"}
            />
          </div>
        </ProfileSection>

        <ProfileSection title="حالة الطلب" icon={FileText}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الحالة" value={statusLabel(row.status)} />
            <InfoRow
              label="تاريخ التقديم"
              value={formatDate(row.created_at) || "—"}
            />
            <InfoRow
              label="تاريخ المراجعة"
              value={row.reviewed_at ? formatDate(row.reviewed_at) || "—" : "—"}
            />
            {row.status === "rejected" ? (
              <InfoRow
                label="سبب الرفض"
                value={row.rejection_reason ?? "—"}
                span2
              />
            ) : null}
          </div>
        </ProfileSection>

        {isPending ? (
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              قرار المراجعة
            </h2>
            <SignupRequestActions
              requestId={row.id}
              redirectTo="/portal/employees/signup-requests"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        <Icon className="w-4 h-4" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  span2 = false,
}: {
  label: string;
  value: string;
  span2?: boolean;
}) {
  return (
    <div
      className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 ${span2 ? "col-span-2" : ""}`}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">
        {value}
      </div>
    </div>
  );
}
