import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Users, ArrowLeft, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getCompaniesWithCounts } from "@/lib/data/companies";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";

export const metadata = { title: "الشركات" };

export default async function CompaniesPage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);

  // Company managers only manage their own company — send them directly there.
  if (profile.role === "company_manager") {
    redirect(
      profile.company_id
        ? `/portal/companies/${profile.company_id}`
        : "/portal",
    );
  }

  const isAdmin = profile.role === "md_admin";

  const rows = await getCompaniesWithCounts();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <PageHeader
          title="شركات المجموعة"
          description="الشركات التابعة لمجموعة MD."
        />
        {isAdmin ? (
          <Link
            href="/portal/companies/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            إضافة شركة
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="لا توجد شركات بعد"
          description={
            isAdmin
              ? "ابدأ بإضافة أول شركة، أو إذا أضفت الشركات من لوحة Supabase فحدّث الصفحة وتأكد أن متغيرات البيئة تشير إلى المشروع الصحيح."
              : "لم يتم إضافة أي شركة بعد."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/portal/companies/${c.id}`}
              className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <ArrowLeft className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:-translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-1 flex items-center gap-2">
                {c.name_ar}
                {!c.active ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    غير نشطة
                  </span>
                ) : null}
              </h3>
              {c.name_en ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {c.name_en}
                </p>
              ) : null}
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                {c.employeeCount} موظف
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
