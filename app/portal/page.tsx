import Link from "next/link";
import {
  Building2,
  Users,
  CalendarCheck,
  FileText,
  Mail,
  Contact,
  ArrowLeft,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";

type Counts = {
  companies: number;
  employees: number;
  attendanceToday: number;
  papers: number;
  mail: number;
  contacts: number;
};

async function getCounts(): Promise<Counts> {
  const supabase = await createSupabaseServerClient();

  // RLS already scopes counts to what the viewer can see.
  const today = new Date().toISOString().slice(0, 10);

  const [companies, employees, attendance, papers, mail, contacts] =
    await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "employee"),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", today),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("mail").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
    ]);

  return {
    companies: companies.count ?? 0,
    employees: employees.count ?? 0,
    attendanceToday: attendance.count ?? 0,
    papers: papers.count ?? 0,
    mail: mail.count ?? 0,
    contacts: contacts.count ?? 0,
  };
}

export default async function PortalDashboard() {
  const { profile } = await requireUser();
  const counts = await getCounts();

  const isAdmin = profile.role === "md_admin";
  const isEmployee = profile.role === "employee";

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {isAdmin ? (
          <StatCard
            label="الشركات النشطة"
            value={counts.companies}
            icon={Building2}
            tone="primary"
          />
        ) : null}
        {!isEmployee ? (
          <StatCard
            label="الموظفون"
            value={counts.employees}
            icon={Users}
            tone="primary"
          />
        ) : null}
        <StatCard
          label={isEmployee ? "سجلاتك اليوم" : "حضور اليوم"}
          value={counts.attendanceToday}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="الأوراق الرسمية"
          value={counts.papers}
          icon={FileText}
          tone="secondary"
        />
        {!isEmployee ? (
          <StatCard
            label="رسائل البريد"
            value={counts.mail}
            icon={Mail}
            tone="warning"
          />
        ) : null}
        <StatCard
          label="جهات الاتصال"
          value={counts.contacts}
          icon={Contact}
          tone="primary"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <QuickLink
          href="/portal/papers"
          title="إدارة الأوراق الرسمية"
          description="رفع ملفات PDF، عقود، ومراسلات، مع بحث نصي داخل المحتوى."
          icon={FileText}
        />
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
          <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">
            {title}
          </h3>
          <ArrowLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:-translate-x-1 transition-all flex-shrink-0" />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}
