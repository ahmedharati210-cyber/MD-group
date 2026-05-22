import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { MailForm } from "../mail-form";
import { createMailAction } from "../actions";

export const metadata = { title: "إضافة بريد" };

export default async function NewMailPage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="max-w-2xl">
      <Link
        href="/portal/mail"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى السجل
      </Link>
      <PageHeader
        title="إضافة بريد"
        description="سجّل رسالة واردة أو صادرة في سجل الشركة."
      />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <MailForm
          action={createMailAction}
          companies={companies ?? []}
          documents={docs ?? []}
          lockedCompanyId={
            profile.role === "company_manager" ? profile.company_id : null
          }
          submitLabel="إضافة"
        />
      </div>
    </div>
  );
}
