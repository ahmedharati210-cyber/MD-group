import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  FileText,
  Pencil,
  Phone,
  StickyNote,
  User,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { formatDate, formatTime } from "@/lib/utils";
import { deleteEmployeeAction } from "../actions";
import type { BloodType, ContractType, EducationLevel, Gender } from "@/types/db";

// ── Label helpers ────────────────────────────────────────────
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

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId, profile: me } = await requireUser();
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

  if (me.role === "employee" && id !== me.id) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("profiles")
    .select("*, companies(id, name_ar)")
    .eq("id", id)
    .single();

  if (!person) notFound();

  const [{ data: attendance }, { data: docs }] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("profile_id", id)
      .order("date", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select("id, title, category, created_at")
      .eq("owner_profile_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const company = (
    person as typeof person & {
      companies?: { id: string; name_ar: string } | null;
    }
  ).companies;

  const canManage =
    me.role === "md_admin" ||
    (me.role === "company_manager" &&
      person.company_id === me.company_id &&
      person.role === "employee");
  const canDelete = canManage && person.id !== userId;
  const canSeeHrNotes = me.role === "md_admin" || me.role === "company_manager";

  return (
    <div>
      {me.role !== "employee" ? (
        <Link
          href="/portal/employees"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى القائمة
        </Link>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <PageHeader
          title={person.full_name}
          description={person.job_title ?? undefined}
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
            {canDelete ? (
              <DeleteButton
                action={deleteEmployeeAction}
                id={id}
                confirmText="سيتم حذف الحساب وبياناته. هل تريد المتابعة؟"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="space-y-4">
        {/* ── Personal Information ─────────────────────────── */}
        <ProfileSection title="المعلومات الشخصية" icon={User}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الشركة" value={company?.name_ar ?? "—"} />
            <InfoRow label="الحالة" value={person.is_active ? "نشط" : "غير نشط"} />
            <InfoRow label="الدور" value={roleLabel(person.role)} />
            <InfoRow label="الهاتف" value={person.phone ?? "—"} />
            <InfoRow label="الجنس" value={genderLabel(person.gender)} />
            <InfoRow label="تاريخ الميلاد" value={formatDate(person.date_of_birth) || "—"} />
            <InfoRow label="الجنسية" value={person.nationality ?? "—"} />
            <InfoRow label="فصيلة الدم" value={bloodLabel(person.blood_type)} />
            <InfoRow label="المستوى التعليمي" value={educationLabel(person.education_level)} />
            <InfoRow label="العنوان" value={person.address ?? "—"} span2 />
          </div>
        </ProfileSection>

        {/* ── Employment Details ───────────────────────────── */}
        <ProfileSection title="بيانات التوظيف" icon={Briefcase}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="المسمى الوظيفي" value={person.job_title ?? "—"} />
            <InfoRow label="القسم" value={person.department ?? "—"} />
            <InfoRow label="تاريخ التوظيف" value={formatDate(person.hired_at) || "—"} />
            <InfoRow label="نوع العقد" value={contractLabel(person.contract_type)} />
            <InfoRow label="تاريخ انتهاء العقد" value={formatDate(person.contract_end_date) || "—"} />
          </div>
        </ProfileSection>

        {/* ── Official Documents ───────────────────────────── */}
        <ProfileSection title="الوثائق الرسمية" icon={FileText}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الرقم الوطني" value={person.national_id ?? "—"} />
            <InfoRow label="رقم جواز السفر" value={person.passport_number ?? "—"} />
          </div>
        </ProfileSection>

        {/* ── Emergency Contact ────────────────────────────── */}
        <ProfileSection title="جهة الاتصال في الطوارئ" icon={Phone}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoRow label="الاسم" value={person.emergency_contact_name ?? "—"} />
            <InfoRow label="رقم الهاتف" value={person.emergency_contact_phone ?? "—"} />
            <InfoRow label="صلة القرابة" value={person.emergency_contact_relationship ?? "—"} />
          </div>
        </ProfileSection>

        {/* ── HR Notes (managers only) ─────────────────────── */}
        {canSeeHrNotes && person.hr_notes ? (
          <ProfileSection title="ملاحظات HR (داخلية)" icon={StickyNote}>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {person.hr_notes}
            </p>
          </ProfileSection>
        ) : null}

        {/* ── Activity ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2 mb-4">
              <CalendarCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              آخر سجلات الحضور
            </h2>
            {!attendance || attendance.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">لا يوجد سجل بعد.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {attendance.map((a) => (
                  <li
                    key={a.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-sm flex-wrap"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {formatDate(a.date)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      {a.check_in ? formatTime(a.check_in) : "—"}
                      {" → "}
                      {a.check_out ? formatTime(a.check_out) : "—"}
                    </span>
                    <span
                      className={
                        a.status === "present"
                          ? "text-emerald-600 dark:text-emerald-400 text-xs font-semibold"
                          : a.status === "late"
                            ? "text-amber-600 dark:text-amber-400 text-xs font-semibold"
                            : "text-gray-500 dark:text-gray-400 text-xs font-semibold"
                      }
                    >
                      {a.status === "present"
                        ? "حاضر"
                        : a.status === "late"
                          ? "متأخر"
                          : a.status === "absent"
                            ? "غائب"
                            : "إجازة"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              الملفات الشخصية
            </h2>
            {!docs || docs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد ملفات شخصية.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {docs.map((d) => (
                  <li key={d.id} className="py-2.5">
                    <Link
                      href={`/portal/papers/${d.id}`}
                      className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-primary-700 dark:hover:text-primary-400"
                    >
                      {d.title}
                    </Link>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {d.category} • {formatDate(d.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Shared UI helpers ────────────────────────────────────────

function roleLabel(role: string) {
  if (role === "md_admin") return "مدير مجموعة";
  if (role === "company_manager") return "مدير شركة";
  return "موظف";
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
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
        {value}
      </div>
    </div>
  );
}
