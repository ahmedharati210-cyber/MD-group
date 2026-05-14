import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { NewEmployeeForm } from "./new-employee-form";

export const metadata = { title: "إضافة موظف" };

export default async function NewEmployeePage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);

  const supabase = await createSupabaseServerClient();
  const companies = await fetchCompaniesForDropdown(supabase);

  return (
    <div className="max-w-3xl">
      <Link
        href="/portal/employees"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى القائمة
      </Link>
      <PageHeader
        title="إضافة موظف جديد"
        description="يُحفظ سجل الموارد البشرية فقط دون إنشاء حساب في المنصّة. لاحقاً يمكن إنشاء حساب تسجيل دخول من لوحة الإدارة عند الحاجة."
      />
      <NewEmployeeForm
        companies={companies ?? []}
        currentRole={profile.role}
        currentCompanyId={profile.company_id}
      />
    </div>
  );
}
