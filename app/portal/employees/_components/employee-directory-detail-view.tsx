import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  FileText,
  Pencil,
  Phone,
  StickyNote,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { formatDate } from "@/lib/utils";
import { deleteEmployeeDirectoryAction } from "../actions";
import type { BloodType, ContractType, EducationLevel, Gender } from "@/types/db";

function genderLabel(v: Gender | null) {
  if (v === "male") return "ذكر";
  if (v === "female") return "أنثى";
  return "—";
}

function contractLabel(v: ContractType | null) {
  if (v === "full_time") return "دوام كامل";
  if (v === "part_time") return "دوام جزئي";
  if (v === "contract") return "عقد مؤقت";
  if (v === "intern") return "متدرب";
  return "—";
}

function educationLabel(v: EducationLevel | null) {
  const map: Record<EducationLevel, string> = {
    high_school: "ثانوي",
    diploma: "دبلوم",
    bachelor: "بكالوريوس",
    master: "ماجستير",
    phd: "دكتوراه",
    other: "أخرى",
  };
  return v ? (map[v] ?? "—") : "—";
}

function bloodLabel(v: BloodType | null) {
  return v ?? "—";
}

function companyFromJoin(embedded: unknown): { id: string; name_ar: string } | null {
  if (!embedded) return null;
  if (Array.isArray(embedded)) {
    const first = embedded[0];
    return first && typeof first === "object" && "name_ar" in first
      ? (first as { id: string; name_ar: string })
      : null;
  }
  if (typeof embedded === "object" && embedded !== null && "name_ar" in embedded) {
    return embedded as { id: string; name_ar: string };
  }
  return null;
}

export function EmployeeDirectoryDetailView({
  row,
  id,
  errorMessage,
  canManage,
}: {
  row: Record<string, unknown>;
  id: string;
  errorMessage?: string;
  canManage: boolean;
}) {
  const company = companyFromJoin(row.companies);

  return (
    <div>
      <Link
        href="/portal/employees"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى القائمة
      </Link>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <PageHeader
          title={row.full_name as string}
          description={(row.job_title as string | null) ?? undefined}
        />
        {canManage ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/employees/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" />
              تعديل
            </Link>
            <DeleteButton
              action={deleteEmployeeDirectoryAction}
              id={id}
              confirmText="سيتم حذف سجل الموظف نهائياً. هل تريد المتابعة؟"
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <ProfileSection title="المعلومات الشخصية" icon={User}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الشركة" value={company?.name_ar ?? "—"} />
            <InfoRow label="الحالة" value={(row.is_active as boolean) ? "نشط" : "غير نشط"} />
            <InfoRow label="الدور" value="موظف" />
            <InfoRow label="الهاتف" value={(row.phone as string | null) ?? "—"} />
            <InfoRow label="بريد المراسلة" value={(row.contact_email as string | null) ?? "—"} />
            <InfoRow label="الجنس" value={genderLabel(row.gender as Gender | null)} />
            <InfoRow
              label="تاريخ الميلاد"
              value={formatDate(row.date_of_birth as string | null) || "—"}
            />
            <InfoRow label="الجنسية" value={(row.nationality as string | null) ?? "—"} />
            <InfoRow label="فصيلة الدم" value={bloodLabel(row.blood_type as BloodType | null)} />
            <InfoRow
              label="المستوى التعليمي"
              value={educationLabel(row.education_level as EducationLevel | null)}
            />
            <InfoRow label="العنوان" value={(row.address as string | null) ?? "—"} span2 />
          </div>
        </ProfileSection>

        <ProfileSection title="بيانات التوظيف" icon={Briefcase}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="المسمى الوظيفي" value={(row.job_title as string | null) ?? "—"} />
            <InfoRow label="الفرع / القسم" value={(row.department as string | null) ?? "—"} />
            <InfoRow label="تاريخ التوظيف" value={formatDate(row.hired_at as string | null) || "—"} />
            <InfoRow
              label="نوع العقد"
              value={contractLabel(row.contract_type as ContractType | null)}
            />
            <InfoRow
              label="تاريخ انتهاء العقد"
              value={formatDate(row.contract_end_date as string | null) || "—"}
            />
          </div>
        </ProfileSection>

        <ProfileSection title="الوثائق الرسمية" icon={FileText}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الرقم الوطني" value={(row.national_id as string | null) ?? "—"} />
            <InfoRow label="رقم جواز السفر" value={(row.passport_number as string | null) ?? "—"} />
          </div>
        </ProfileSection>

        <ProfileSection title="جهة الاتصال في الطوارئ" icon={Phone}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الاسم" value={(row.emergency_contact_name as string | null) ?? "—"} />
            <InfoRow
              label="رقم الهاتف"
              value={(row.emergency_contact_phone as string | null) ?? "—"}
            />
            <InfoRow
              label="صلة القرابة"
              value={(row.emergency_contact_relationship as string | null) ?? "—"}
            />
          </div>
        </ProfileSection>

        {(row.hr_notes as string | null) ? (
          <ProfileSection title="ملاحظات HR (داخلية)" icon={StickyNote}>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {row.hr_notes as string}
            </p>
          </ProfileSection>
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
    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
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
    <div className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 ${span2 ? "col-span-2" : ""}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{value}</div>
    </div>
  );
}
