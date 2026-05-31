import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Building2,
  CalendarCheck,
  FileText,
  Pencil,
  User,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { formatDate } from "@/lib/utils";
import { deleteMailAction } from "../actions";

export default async function MailDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { profile: viewer } = await requireRole(["md_admin", "company_manager", "owner"]);
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: mail } = await supabase
    .from("mail")
    .select("*, companies(id, name_ar), documents:related_document_id(id, title)")
    .eq("id", id)
    .single();

  if (!mail) notFound();

  type MailJoined = typeof mail & {
    companies?: { id: string; name_ar: string } | null;
    documents?: { id: string; title: string } | null;
  };
  const joined = mail as MailJoined;
  const company = joined.companies;
  const doc = joined.documents;
  const inbound = mail.direction === "inbound";

  return (
    <div>
      <Link
        href="/portal/mail"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى السجل
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={
              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 " +
              (inbound
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300")
            }
          >
            {inbound ? (
              <ArrowDownToLine className="w-5 h-5" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <PageHeader
              title={mail.subject}
              description={inbound ? "بريد وارد" : "بريد صادر"}
            />
          </div>
        </div>

        {viewer.role !== "owner" ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/mail/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" />
              تعديل
            </Link>
            <DeleteButton action={deleteMailAction} id={id} />
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Info
          icon={Building2}
          label="الشركة"
          value={company?.name_ar ?? "—"}
        />
        <Info
          icon={User}
          label={inbound ? "من" : "إلى"}
          value={(inbound ? mail.from_name : mail.to_name) ?? "—"}
        />
        <Info
          icon={CalendarCheck}
          label="التاريخ"
          value={formatDate(mail.created_at)}
        />
        {mail.status ? (
          <Info label="الحالة" value={mail.status} />
        ) : null}
        {doc ? (
          <div className="sm:col-span-2 md:col-span-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ورقة مرفقة
              </div>
              <Link
                href={`/portal/papers/${doc.id}`}
                className="text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline truncate block"
              >
                {doc.title}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {mail.body ? (
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-50 mb-3">
            المحتوى
          </h2>
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
            {mail.body}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Building2;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 sm:p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
        {value}
      </div>
    </div>
  );
}
