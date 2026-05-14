import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { ContactForm } from "../contact-form";
import { createContactAction } from "../actions";
import { isConstructionCompany } from "@/lib/features";

export const metadata = { title: "إضافة جهة اتصال" };

export default async function NewContactPage() {
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const companies = await fetchCompaniesForDropdown(supabase);

  // Trade categories only shown for the construction company (has timeline feature)
  const showTradeCategory = await isConstructionCompany(supabase, profile.company_id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/portal/contacts"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى القائمة
      </Link>
      <PageHeader title="إضافة جهة اتصال" />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <ContactForm
          action={createContactAction}
          companies={companies ?? []}
          lockedCompanyId={
            profile.role === "company_manager" ? profile.company_id : null
          }
          showTradeCategory={showTradeCategory}
          submitLabel="إضافة"
        />
      </div>
    </div>
  );
}
