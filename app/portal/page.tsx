import Link from "next/link";
import {
  Building2,
  Users,
  CalendarCheck,
  FileText,
  Mail,
  Contact,
  ArrowLeft,
  FolderKanban,
  FileBarChart2,
  ClipboardEdit,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getVisibleFeatures, isMdManagerFeatureAllowed, OWNER_FEATURES } from "@/lib/features";
import { getCompanyData } from "@/lib/company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getDashboardData } from "@/lib/data/dashboard";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import type { AppFeature, ProjectStatus, RoleFeatures } from "@/types/db";
import type { ProjectProgressRow } from "@/lib/data/dashboard";

const statusLabels: Record<ProjectStatus, { label: string; cls: string }> = {
  planning:    { label: "تصميم",                cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  active:      { label: "انشاء (اعمال الهيكل)", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  completed:   { label: "تشطيب",               cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  maintenance: { label: "صيانة",               cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  survey:      { label: "رفع مساحي",            cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  on_hold:       { label: "متوقف",               cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  on_hold_claim: { label: "متوقف ( مطالبة)",    cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
};

export default async function PortalDashboard() {
  const { profile } = await requireUser();

  const shellCompanyId =
    profile.company_id ??
    ((profile.role === "md_admin" || profile.role === "owner") && !(profile.is_super_admin ?? false)
      ? await getShellCompanyIdForProfile(profile)
      : null);

  const companyRow = shellCompanyId
    ? await getCompanyData(shellCompanyId)
    : null;
  const enabledFeatures: AppFeature[] | null = companyRow?.enabled_features ?? null;
  const roleFeatures: RoleFeatures | null = companyRow?.role_features ?? null;

  const visibleFeatures = getVisibleFeatures(
    profile.role,
    enabledFeatures,
    roleFeatures,
    profile.is_super_admin ?? false,
  );

  const hasFeature = (f: AppFeature) => {
    if (profile.is_super_admin) {
      return visibleFeatures === null || visibleFeatures.includes(f);
    }
    if (profile.role === "md_admin") {
      return isMdManagerFeatureAllowed(f, enabledFeatures);
    }
    if (profile.role === "owner") {
      return OWNER_FEATURES.includes(f);
    }
    return visibleFeatures === null || visibleFeatures.includes(f);
  };

  // Owners see all-company stats like md_admin (no company restriction)
  const isAdmin = profile.role === "md_admin" || profile.role === "owner";
  const isEmployee = profile.role === "employee";

  const { counts, topProjects } = await getDashboardData({
    profileId: profile.id ?? "",
    isEmployee,
  });

  return (
    <div>
      <PageHeader
        title={`مرحبًا، ${profile.full_name}`}
        description={
          isEmployee
            ? "هذه نظرة سريعة على ملفك الشخصي والأنشطة اليومية."
            : "هذه نظرة عامة على بياناتك. جميع الأرقام مُقيّدة بصلاحياتك."
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {isAdmin ? (
          <StatCard label="الشركات النشطة" value={counts.companies} icon={Building2} tone="primary" href="/portal/companies" />
        ) : null}
        {!isEmployee ? (
          <StatCard label="الموظفون" value={counts.employees} icon={Users} tone="primary" href="/portal/employees" />
        ) : null}
        {hasFeature("attendance") ? (
          <StatCard label={isEmployee ? "سجلاتك اليوم" : "حضور اليوم"} value={counts.attendanceToday} icon={CalendarCheck} tone="success" href="/portal/attendance" />
        ) : null}
        {hasFeature("papers") ? (
          <StatCard label="الأوراق الرسمية" value={counts.papers} icon={FileText} tone="secondary" href="/portal/papers" />
        ) : null}
        {!isEmployee && hasFeature("mail") ? (
          <StatCard label="رسائل البريد" value={counts.mail} icon={Mail} tone="warning" href="/portal/mail" />
        ) : null}
        {hasFeature("contacts") ? (
          <StatCard label="جهات الاتصال" value={counts.contacts} icon={Contact} tone="primary" href="/portal/contacts" />
        ) : null}
        {hasFeature("timeline") ? (
          <StatCard label="إجمالي المشاريع" value={counts.projects} icon={FolderKanban} tone="success" href="/portal/timeline" />
        ) : null}
        {hasFeature("requests") ? (
          <StatCard
            label={isEmployee ? "طلباتي المعلقة" : "طلبات معلقة"}
            value={counts.pendingRequests}
            icon={ClipboardEdit}
            tone="warning"
            href="/portal/requests"
          />
        ) : null}
        {hasFeature("timeline") && counts.overdueTasks > 0 ? (
          <StatCard label="مهام متأخرة" value={counts.overdueTasks} icon={AlertCircle} tone="danger" href="/portal/timeline" />
        ) : null}
        {hasFeature("warnings") ? (
          <StatCard
            label={isEmployee ? "إشعارات غير مقروءة" : "مركز الإشعارات"}
            value={counts.warnings}
            icon={AlertTriangle}
            tone="danger"
            href="/portal/notifications"
          />
        ) : null}
      </div>

      {/* Active projects widget */}
      {hasFeature("timeline") && topProjects.length > 0 ? (
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">أبرز المشاريع النشطة</h2>
            <Link href="/portal/timeline" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {topProjects.map((p) => {
              const allTasks = p.categories.flatMap((c) => c.tasks);
              const total = allTasks.length;
              const done = allTasks.filter((t) => t.is_completed).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const { label, cls } = statusLabels[p.status];
              return (
                <Link
                  key={p.id}
                  href={`/portal/timeline/${p.id}`}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50 text-sm truncate">{p.name}</h3>
                    <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    <span>{total} مهمة</span>
                    <span className="tabular-nums">{done}/{total} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 dark:bg-primary-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quick links — only shown for enabled features */}
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {hasFeature("timeline") ? (
          <QuickLink
            href="/portal/timeline"
            title="المشاريع"
            description="تابع مراحل المشاريع الهندسية ونسب الإنجاز."
            icon={FolderKanban}
          />
        ) : null}
        {hasFeature("reports") ? (
          <QuickLink
            href="/portal/reports"
            title="التقارير"
            description="أضف تقاريرك اليومية والأسبوعية عن مواقع العمل."
            icon={FileBarChart2}
          />
        ) : null}
        {hasFeature("papers") ? (
          <QuickLink
            href="/portal/papers"
            title="إدارة الأوراق الرسمية"
            description="رفع ملفات PDF، عقود، ومراسلات، مع بحث نصي داخل المحتوى."
            icon={FileText}
          />
        ) : null}
        {hasFeature("attendance") ? (
          <QuickLink
            href="/portal/attendance"
            title="الحضور والانصراف"
            description={
              isEmployee
                ? "سجّل حضورك اليومي وراجع سجلاتك السابقة."
                : "مراجعة سجلات الحضور اليومية والشهرية."
            }
            icon={CalendarCheck}
          />
        ) : null}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      href={href}
      className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all flex items-start gap-4"
    >
      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-primary-50 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/60 transition-colors">
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">{title}</h3>
          <ArrowLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:-translate-x-1 transition-all flex-shrink-0" />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}
