import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { MailForm } from "../../mail-form";
import { updateMailAction } from "../../actions";

export const metadata = { title: "تعديل بريد" };

export default async function EditMailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await requireRole(["md_admin", "company_manager"]);
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const [{ data: mail }, { data: companies }, { data: docs }] =
    await Promise.all([
      supabase.from("mail").select("*").eq("id", id).single(),
      supabase.from("companies").select("id, name_ar").order("name_ar"),
      supabase
        .from("documents")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (!mail) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href={`/portal/mail/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للتفاصيل
      </Link>
      <PageHeader title="تعديل البريد" description={mail.subject} />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <MailForm
          action={updateMailAction}
          companies={companies ?? []}
          documents={docs ?? []}
          lockedCompanyId={
            profile.role === "company_manager" ? profile.company_id : null
          }
          initial={mail}
          submitLabel="حفظ التعديلات"
        />
      </div>
    </div>
  );
}
