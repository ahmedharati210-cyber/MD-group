import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { updateCompanyAction } from "../../actions";
import { CompanyForm } from "../../company-form";

export const metadata = { title: "تعديل شركة" };

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) notFound();

  return (
    <div>
      <Link
        href={`/portal/companies/${companyId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الشركة
      </Link>
      <PageHeader
        title="تعديل الشركة"
        description={company.name_ar}
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs max-w-3xl">
        <CompanyForm
          action={updateCompanyAction}
          initial={company}
          submitLabel="حفظ التعديلات"
        />
      </div>
    </div>
  );
}
