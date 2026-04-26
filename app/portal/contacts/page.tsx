import Link from "next/link";
import {
  Contact as ContactIcon,
  Plus,
  Phone,
  Mail as MailIcon,
  Building2,
  Pencil,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { deleteContactAction } from "./actions";

export const metadata = { title: "جهات الاتصال" };

type SearchParams = Promise<{ q?: string; companyId?: string }>;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireUser();
  const canEdit = profile.role !== "employee";
  const { q, companyId } = await searchParams;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("contacts")
    .select("*, companies(name_ar)")
    .order("full_name")
    .limit(200);
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (companyId) query = query.eq("company_id", companyId);

  const { data: contacts } = await query;
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  return (
    <div>
      <PageHeader
        title="جهات الاتصال"
        description="دليل جهات الاتصال الخارجية."
        action={
          canEdit ? (
            <Link
              href="/portal/contacts/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              إضافة جهة
            </Link>
          ) : null
        }
      />

      <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="بحث بالاسم..."
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
        />
        {profile.role === "md_admin" ? (
          <select
            name="companyId"
            defaultValue={companyId ?? ""}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
          >
            <option value="">الكل</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white"
        >
          بحث
        </button>
      </form>

      {!contacts || contacts.length === 0 ? (
        <EmptyState
          icon={ContactIcon}
          title="لا توجد جهات"
          description={canEdit ? "أضف جهة اتصال جديدة للبدء." : "لا توجد جهات معتمدة بعد."}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {contacts.map((c) => {
            const company = (
              c as typeof c & { companies?: { name_ar: string } | null }
            ).companies;
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {c.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 dark:text-gray-50 truncate">
                      {c.full_name}
                    </div>
                    {c.title || c.organization ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {[c.title, c.organization].filter(Boolean).join(" • ")}
                      </div>
                    ) : null}
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {c.phone ? (
                    <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <a
                        href={`tel:${c.phone}`}
                        className="hover:text-primary-700 dark:hover:text-primary-400 truncate"
                        dir="ltr"
                      >
                        {c.phone}
                      </a>
                    </li>
                  ) : null}
                  {c.email ? (
                    <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <MailIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <a
                        href={`mailto:${c.email}`}
                        className="hover:text-primary-700 dark:hover:text-primary-400 truncate"
                      >
                        {c.email}
                      </a>
                    </li>
                  ) : null}
                  {company ? (
                    <li className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{company.name_ar}</span>
                    </li>
                  ) : null}
                </ul>
                {canEdit ? (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                    <Link
                      href={`/portal/contacts/${c.id}/edit`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      تعديل
                    </Link>
                    <DeleteButton
                      action={deleteContactAction}
                      id={c.id}
                      compact
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
