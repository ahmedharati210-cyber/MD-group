import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Receipt, FileText, Banknote, AlignLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { DeleteClaimButton } from "@/components/claims/DeleteClaimButton";

export const metadata = { title: "تفاصيل المطالبة" };

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();

  const { data: claim } = await supabase
    .from("manager_claims")
    .select("id, title, description, amount, file_url, created_at")
    .eq("id", id)
    .single();

  if (!claim) notFound();

  return (
    <div className="max-w-2xl">
      {/* Back */}
      <Link
        href="/portal/claims"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى المطالبات
      </Link>

      {/* Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">{claim.title}</h1>
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(claim.created_at)}
              </span>
            </div>
          </div>
          <DeleteClaimButton claimId={claim.id} />
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Amount */}
          {claim.amount != null ? (
            <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
              <Banknote className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-0.5">المبلغ</p>
                <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                  {Number(claim.amount).toLocaleString("ar-LY")} ل.د
                </p>
              </div>
            </div>
          ) : null}

          {/* Description */}
          {claim.description ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">الوصف</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                {claim.description}
              </p>
            </div>
          ) : null}

          {/* PDF */}
          {claim.file_url ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">المستند المرفق</span>
              </div>
              {/* Inline PDF preview */}
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <iframe
                  src={claim.file_url}
                  title="مستند المطالبة"
                  className="w-full"
                  style={{ height: "520px" }}
                />
              </div>
              <a
                href={claim.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                فتح في تبويب جديد
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">لا يوجد ملف مرفق.</p>
          )}
        </div>
      </div>
    </div>
  );
}
