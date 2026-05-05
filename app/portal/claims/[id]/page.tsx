import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, Receipt, FileText, Banknote, AlignLeft, Download, MapPin } from "lucide-react";
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

  const { data: rawClaim } = await supabase
    .from("manager_claims")
    .select("id, title, description, amount, file_url, created_at, project:project_id(id, name)")
    .eq("id", id)
    .single();

  if (!rawClaim) notFound();

  const claim = rawClaim as typeof rawClaim & { project: { id: string; name: string } | null };

  // Generate a short-lived signed download URL (bucket is private, no public URLs).
  // New records store the bare storage path; old records may store a full URL — extract path from those.
  let signedFileUrl: string | null = null;
  if (claim.file_url) {
    const storagePath = claim.file_url.startsWith("http")
      ? claim.file_url.split("/documents/")[1] ?? claim.file_url
      : claim.file_url;
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 60); // 1 hour
    signedFileUrl = signed?.signedUrl ?? null;
  }

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
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDate(claim.created_at)}
                </span>
                {claim.project ? (
                  <Link
                    href={`/portal/timeline/${claim.project.id}`}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {claim.project.name}
                  </Link>
                ) : null}
              </div>
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

          {/* PDF download */}
          {claim.file_url ? (
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">المستند المرفق</span>
              {signedFileUrl ? (
                <a
                  href={signedFileUrl}
                  download
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  تحميل
                </a>
              ) : (
                <span className="text-xs text-gray-400">تعذّر توليد رابط التحميل</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">لا يوجد ملف مرفق.</p>
          )}
        </div>
      </div>
    </div>
  );
}
