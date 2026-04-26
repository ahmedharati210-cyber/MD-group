import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { NewEmployeeForm } from "./new-employee-form";

export const metadata = { title: "إضافة موظف" };

export default async function NewEmployeePage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  return (
    <div className="max-w-2xl">
      <Link
        href="/portal/employees"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى القائمة
      </Link>
      <PageHeader
        title="إضافة موظف جديد"
        description="سيتم إنشاء حساب تسجيل دخول للموظف وإرساله للمدير."
      />

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <NewEmployeeForm
          companies={companies ?? []}
          currentRole={profile.role}
          currentCompanyId={profile.company_id}
        />
      </div>
    </div>
  );
}
