import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  Users,
  FileText,
  CalendarCheck,
  Mail,
  Pencil,
  ArrowRight,
  FolderKanban,
  Receipt,
  ClipboardEdit,
  FileBarChart2,
  Map,
  AlertTriangle,
  Contact,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/portal/StatCard";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { deleteCompanyAction } from "../actions";
import { SetActiveCompanyOnVisit } from "@/components/portal/SetActiveCompanyOnVisit";
import { isFeatureEnabled, featureLabels } from "@/lib/features";
import type { AppFeature } from "@/types/db";

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const { companyId } = await params;
  const { error: errorMessage } = await searchParams;
  const isAdmin = profile.role === "md_admin";
  const isMdGroupManager = profile.role === "md_admin" && !profile.is_super_admin;
  const supabase = await createSupabaseServerClient();

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) notFound();

  const enabled = company.enabled_features as AppFeature[] | null;
  const has = (f: AppFeature) => isFeatureEnabled(f, enabled, false);
  const today = new Date().toISOString().slice(0, 10);

  const [
    emp,
    att,
    docs,
    mailC,
    projC,
    claimsC,
    reqC,
    mapsC,
    warnC,
    repC,
    contactsC,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "employee")
      .eq("company_id", companyId),
    has("attendance")
      ? supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("date", today)
      : Promise.resolve({ count: 0 }),
    has("papers")
      ? supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("mail")
      ? supabase
          .from("mail")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("timeline")
      ? supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("claims")
      ? supabase
          .from("manager_claims")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("requests")
      ? supabase
          .from("engineer_requests")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("maps")
      ? supabase
          .from("map_links")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("warnings")
      ? supabase
          .from("warnings")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("reports")
      ? supabase
          .from("engineer_reports")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
    has("contacts")
      ? supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
  ]);

  type Tone = "primary" | "success" | "secondary" | "warning";
  const q = (path: string) => `${path}?companyId=${encodeURIComponent(companyId)}`;
  const stats: {
    label: string;
    value: number;
    icon: typeof Building2;
    tone: Tone;
    show: boolean;
    href?: string;
  }[] = [
    {
      label: "الموظفون",
      value: emp.count ?? 0,
      icon: Users,
      tone: "primary",
      show: true,
      href: q("/portal/employees"),
    },
    {
      label: "حضور اليوم",
      value: att.count ?? 0,
      icon: CalendarCheck,
      tone: "success",
      show: has("attendance"),
      href: q("/portal/attendance"),
    },
    {
      label: featureLabels.papers,
      value: docs.count ?? 0,
      icon: FileText,
      tone: "secondary",
      show: has("papers"),
      href: q("/portal/papers"),
    },
    {
      label: featureLabels.mail,
      value: mailC.count ?? 0,
      icon: Mail,
      tone: "warning",
      show: has("mail"),
      href: q("/portal/mail"),
    },
    {
      label: featureLabels.timeline,
      value: projC.count ?? 0,
      icon: FolderKanban,
      tone: "primary",
      show: has("timeline"),
      href: q("/portal/timeline"),
    },
    {
      label: featureLabels.claims,
      value: claimsC.count ?? 0,
      icon: Receipt,
      tone: "secondary",
      show: has("claims"),
      href: q("/portal/claims"),
    },
    {
      label: featureLabels.requests,
      value: reqC.count ?? 0,
      icon: ClipboardEdit,
      tone: "warning",
      show: has("requests"),
      href: q("/portal/requests"),
    },
    {
      label: featureLabels.maps,
      value: mapsC.count ?? 0,
      icon: Map,
      tone: "success",
      show: has("maps"),
      href: q("/portal/maps"),
    },
    {
      label: featureLabels.warnings,
      value: warnC.count ?? 0,
      icon: AlertTriangle,
      tone: "warning",
      show: has("warnings"),
      href: q("/portal/notifications"),
    },
    {
      label: featureLabels.reports,
      value: repC.count ?? 0,
      icon: FileBarChart2,
      tone: "secondary",
      show: has("reports"),
      href: q("/portal/reports"),
    },
    {
      label: featureLabels.contacts,
      value: contactsC.count ?? 0,
      icon: Contact,
      tone: "primary",
      show: has("contacts"),
      href: q("/portal/contacts"),
    },
  ];

  const quickLinks: {
    href: string;
    title: string;
    icon: typeof Building2;
    show: boolean;
  }[] = [
    {
      href: `/portal/employees?companyId=${company.id}`,
      title: "موظفو الشركة",
      icon: Users,
      show: true,
    },
    {
      href: `/portal/papers?companyId=${company.id}`,
      title: "أوراق الشركة",
      icon: FileText,
      show: has("papers"),
    },
    {
      href: `/portal/attendance?companyId=${company.id}`,
      title: "حضور الشركة",
      icon: CalendarCheck,
      show: has("attendance"),
    },
    {
      href: `/portal/mail?companyId=${company.id}`,
      title: "بريد الشركة",
      icon: Mail,
      show: has("mail"),
    },
    {
      href: q("/portal/timeline"),
      title: "مشاريع الشركة",
      icon: FolderKanban,
      show: has("timeline"),
    },
    {
      href: q("/portal/claims"),
      title: "مطالبات الشركة",
      icon: Receipt,
      show: has("claims"),
    },
    {
      href: q("/portal/requests"),
      title: "طلبات الشركة",
      icon: ClipboardEdit,
      show: has("requests"),
    },
    {
      href: q("/portal/reports"),
      title: "تقارير الشركة",
      icon: FileBarChart2,
      show: has("reports"),
    },
    {
      href: q("/portal/maps"),
      title: "خرائط الشركة",
      icon: Map,
      show: has("maps"),
    },
    {
      href: q("/portal/notifications"),
      title: "إشعارات الشركة",
      icon: AlertTriangle,
      show: has("warnings"),
    },
    {
      href: `/portal/contacts?companyId=${company.id}`,
      title: "جهات اتصال الشركة",
      icon: Contact,
      show: has("contacts"),
    },
  ];

  return (
    <div>
      <SetActiveCompanyOnVisit companyId={companyId} enabled={isMdGroupManager} />
      {isAdmin ? (
        <Link
          href="/portal/companies"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى الشركات
        </Link>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-50 truncate">
              {company.name_ar}
            </h1>
            {company.name_en ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {company.name_en}
              </p>
            ) : null}
          </div>
        </div>

        {profile.is_super_admin ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/companies/${companyId}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" />
              تعديل
            </Link>
            <DeleteButton
              action={deleteCompanyAction}
              id={companyId}
              confirmText="سيتم حذف الشركة. تأكد من عدم وجود موظفين مرتبطين. هل تريد المتابعة؟"
            />
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats
          .filter((s) => s.show)
          .map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              icon={s.icon}
              tone={s.tone}
              href={s.href}
            />
          ))}
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {quickLinks
          .filter((q) => q.show)
          .map((q) => (
            <QuickLink key={q.href} href={q.href} title={q.title} icon={q.icon} />
          ))}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: typeof Building2;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800 transition-all flex items-center gap-3"
    >
      <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      </div>
      <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">
        {title}
      </span>
    </Link>
  );
}
