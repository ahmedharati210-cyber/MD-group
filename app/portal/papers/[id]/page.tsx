import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Calendar, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { bytesToReadable, formatDate } from "@/lib/utils";
import { PaperViewer } from "./paper-viewer";
import { deletePaperAction } from "../actions";
import { paperCategoryLabelFor } from "@/lib/paper-categories";
import { PaperDatesForm } from "./paper-dates-form";

export default async function PaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId, profile } = await requireUser();
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*, companies(name_ar), profiles:owner_profile_id(full_name)")
    .eq("id", id)
    .single();

  if (!doc) notFound();

  const company = (doc as typeof doc & { companies?: { name_ar: string } | null })
    .companies;
  const owner = (doc as typeof doc & { profiles?: { full_name: string } | null })
    .profiles;

  const canDelete =
    profile.is_super_admin ||
    profile.role === "md_admin" ||
    (profile.role === "company_manager" &&
      doc.company_id === profile.company_id);

  const canEditPaperDates =
    canDelete ||
    (profile.role === "employee" && doc.owner_profile_id === userId);

  const issuedOn = (doc as { issued_on?: string | null }).issued_on ?? null;
  const expiresOn = (doc as { expires_on?: string | null }).expires_on ?? null;
  const expiryNotifiedAt =
    (doc as { expiry_notified_at?: string | null }).expiry_notified_at ?? null;

  return (
    <div>
      <Link
        href="/portal/papers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الأوراق
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <PageHeader
          title={doc.title}
          description={paperCategoryLabelFor(doc.category)}
        />
        {canDelete ? (
          <DeleteButton
            action={deletePaperAction}
            id={id}
            confirmText="سيتم حذف الملف والورقة نهائيًا. هل تريد المتابعة؟"
          />
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-2 order-2 md:order-1">
          <PaperViewer id={doc.id} mimeType={doc.mime_type} />
        </div>

        <aside className="space-y-4 order-1 md:order-2">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm space-y-3">
            <Meta
              icon={Building2}
              label="الشركة"
              value={company?.name_ar ?? "—"}
            />
            {owner ? (
              <Meta icon={User} label="الموظف" value={owner.full_name} />
            ) : null}
            <Meta
              icon={Calendar}
              label="تاريخ الرفع"
              value={formatDate(doc.created_at)}
            />
            <Meta
              label="الحجم"
              value={bytesToReadable(doc.size_bytes)}
              plain
            />
            {doc.mime_type ? (
              <Meta label="النوع" value={doc.mime_type} plain />
            ) : null}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              بيانات الورقة
            </h3>
            <PaperDatesForm
              key={doc.id}
              documentId={doc.id}
              title={doc.title}
              category={doc.category}
              issuedOn={issuedOn}
              expiresOn={expiresOn}
              expiryNotifiedAt={expiryNotifiedAt}
              canEdit={canEditPaperDates}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  plain,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <div className={plain ? "" : "flex items-center gap-3"}>
      {Icon ? (
        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-all">
          {value}
        </div>
      </div>
    </div>
  );
}
