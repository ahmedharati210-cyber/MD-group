import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { ContactForm } from "../../contact-form";
import { updateContactAction } from "../../actions";

export const metadata = { title: "تعديل جهة اتصال" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const [{ data: contact }, { data: companies }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).single(),
    supabase.from("companies").select("id, name_ar").order("name_ar"),
  ]);

  if (!contact) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/portal/contacts"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى القائمة
      </Link>
      <PageHeader title="تعديل جهة الاتصال" description={contact.full_name} />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <ContactForm
          action={updateContactAction}
          companies={companies ?? []}
          lockedCompanyId={
            profile.role === "company_manager" ? profile.company_id : null
          }
          initial={contact}
          submitLabel="حفظ التعديلات"
        />
      </div>
    </div>
  );
}
