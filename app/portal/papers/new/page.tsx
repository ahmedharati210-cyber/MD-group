import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { UploadPaperForm } from "./upload-paper-form";

export const metadata = { title: "رفع ورقة" };

export default async function NewPaperPage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);

  const supabase = await createSupabaseServerClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, company_id")
    .eq("role", "employee")
    .eq("is_active", true)
    .order("full_name");

  return (
    <div className="max-w-2xl">
      <Link
        href="/portal/papers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الأوراق
      </Link>
      <PageHeader
        title="رفع ورقة جديدة"
        description="ارفع ملف PDF أو صورة. يتم استخراج النصّ تلقائياً لتمكين البحث."
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
        <UploadPaperForm
          companies={companies ?? []}
          employees={employees ?? []}
          currentCompanyId={profile.company_id}
          isAdmin={profile.role === "md_admin"}
        />
      </div>
    </div>
  );
}
