import Link from "next/link";
import {
  Contact as ContactIcon,
  Plus,
  Phone,
  Mail as MailIcon,
  Building2,
  Pencil,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getContactsData } from "@/lib/data/contacts";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { deleteContactAction } from "./actions";
import type { TradeCategory } from "@/types/db";

export const metadata = { title: "جهات الاتصال" };

const PAGE_SIZE = 30;

type ContactItem = {
  id: string;
  full_name: string;
  title: string | null;
  organization: string | null;
  trade_category: string | null;
  phone: string | null;
  email: string | null;
  companies?: { name_ar: string } | null;
};

type SearchParams = Promise<{ q?: string; companyId?: string; trade?: string; page?: string }>;

const tradeLabels: Record<TradeCategory, string> = {
  laborer: "عمال",
  technician: "فني",
  mechanic: "ميكانيكي",
  electrician: "كهربائي",
  other: "أخرى",
};

const tradeBadgeCls: Record<TradeCategory, string> = {
  laborer: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  technician: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mechanic: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  electrician: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireFeature("contacts");
  const canEdit = profile.role !== "employee";
  const { q, companyId, trade, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const shellId = await getShellCompanyIdForProfile(profile);

  const { contacts, totalCount, companies, showTradeFilter } = await getContactsData({
    role: profile.role,
    companyId: profile.company_id,
    shellCompanyId: shellId,
    q,
    filterCompanyId: companyId,
    trade,
    page,
    pageSize: PAGE_SIZE,
  });
  const showTradeBadge = showTradeFilter;

  return (
    <div>
      <PageHeader
        title="جهات الاتصال"
        description="دليل جهات الاتصال — موظفون، عمال، فنيون، وأخرى."
        action={
          canEdit ? (
            <Link href="/portal/contacts/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 w-full sm:w-auto justify-center">
              <Plus className="w-4 h-4" />
              إضافة جهة
            </Link>
          ) : null
        }
      />

      <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="بحث بالاسم..."
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
        />
        {showTradeFilter ? (
          <select
            name="trade"
            defaultValue={trade ?? ""}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
          >
            <option value="">كل التخصصات</option>
            {(Object.entries(tradeLabels) as [TradeCategory, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ) : null}
        {profile.role === "md_admin" ? (
          <select
            name="companyId"
            defaultValue={companyId ?? ""}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
          >
            <option value="">الكل</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        ) : null}
        <button type="submit" className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white">
          بحث
        </button>
      </form>

      {contacts.length === 0 ? (
        <EmptyState icon={ContactIcon} title="لا توجد جهات" description={canEdit ? "أضف جهة اتصال جديدة للبدء." : "لا توجد جهات معتمدة بعد."} />
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {(contacts as ContactItem[]).map((c) => {
            const company = c.companies;
            const tradeKey = (c.trade_category as TradeCategory | null);
            return (
              <div key={c.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {c.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 dark:text-gray-50 truncate">{c.full_name}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {c.title || c.organization ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {[c.title, c.organization].filter(Boolean).join(" • ")}
                        </span>
                      ) : null}
                      {showTradeBadge && tradeKey ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tradeBadgeCls[tradeKey]}`}>
                          {tradeLabels[tradeKey]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {c.phone ? (
                    <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <a href={`tel:${c.phone}`} className="hover:text-primary-700 dark:hover:text-primary-400 truncate" dir="ltr">{c.phone}</a>
                    </li>
                  ) : null}
                  {c.email ? (
                    <li className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <MailIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <a href={`mailto:${c.email}`} className="hover:text-primary-700 dark:hover:text-primary-400 truncate">{c.email}</a>
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
                    <Link href={`/portal/contacts/${c.id}/edit`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700">
                      <Pencil className="w-3.5 h-3.5" />
                      تعديل
                    </Link>
                    <DeleteButton action={deleteContactAction} id={c.id} compact />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <Pagination
          page={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          baseUrl="/portal/contacts"
          extraParams={{
            ...(q ? { q } : {}),
            ...(companyId ? { companyId } : {}),
            ...(trade ? { trade } : {}),
          }}
        />
        </>
      )}
    </div>
  );
}
