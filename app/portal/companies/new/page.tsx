import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/portal/PageHeader";
import { createCompanyAction } from "../actions";
import { CompanyForm } from "../company-form";

export const metadata = { title: "إضافة شركة" };

export default async function NewCompanyPage() {
  await requireSuperAdmin();
  return (
    <div>
      <Link
        href="/portal/companies"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الشركات
      </Link>
      <PageHeader
        title="إضافة شركة"
        description="أنشئ شركة جديدة ضمن مجموعة MD."
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs max-w-3xl">
        <CompanyForm action={createCompanyAction} submitLabel="إضافة الشركة" />
      </div>
    </div>
  );
}
