import Link from "next/link";
import {
  Mail,
  Plus,
  ArrowUpFromLine,
  ArrowDownToLine,
  Building2,
  Inbox,
  Send,
  LayoutList,
} from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "البريد" };

const PAGE_SIZE = 25;

type SearchParams = Promise<{
  direction?: string;
  companyId?: string;
  q?: string;
  page?: string;
}>;

export default async function MailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireFeature("mail", ["md_admin", "company_manager"]);
  const { direction, companyId, q, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const tab: "all" | "inbound" | "outbound" =
    direction === "inbound" || direction === "outbound" ? direction : "all";

  const supabase = await createSupabaseServerClient();

  // Tab counts (respect companyId filter).
  const buildCount = async (dir?: "inbound" | "outbound") => {
    let q2 = supabase
      .from("mail")
      .select("id", { count: "exact", head: true });
    if (dir) q2 = q2.eq("direction", dir);
    if (companyId) q2 = q2.eq("company_id", companyId);
    const { count } = await q2;
    return count ?? 0;
  };
  const [total, inboundCount, outboundCount] = await Promise.all([
    buildCount(),
    buildCount("inbound"),
    buildCount("outbound"),
  ]);

  let query = supabase
    .from("mail")
    .select("*, companies(name_ar)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (tab !== "all") query = query.eq("direction", tab);
  if (companyId) query = query.eq("company_id", companyId);
  if (q) query = query.ilike("subject", `%${q}%`);

  const { data: mails, count } = await query;
  const totalCount = count ?? 0;

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  const baseParams = new URLSearchParams();
  if (companyId) baseParams.set("companyId", companyId);
  if (q) baseParams.set("q", q);

  const tabHref = (t: "all" | "inbound" | "outbound") => {
    const p = new URLSearchParams(baseParams);
    if (t !== "all") p.set("direction", t);
    const qs = p.toString();
    return `/portal/mail${qs ? `?${qs}` : ""}`;
  };

  const tabs = [
    { id: "all" as const, label: "الكل", icon: LayoutList, count: total },
    {
      id: "inbound" as const,
      label: "الوارد",
      icon: Inbox,
      count: inboundCount,
    },
    {
      id: "outbound" as const,
      label: "الصادر",
      icon: Send,
      count: outboundCount,
    },
  ];

  return (
    <div>
      <PageHeader
        title="البريد"
        description="سجل البريد الوارد والصادر."
        action={
          <Link
            href="/portal/mail/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            بريد جديد
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 overflow-x-auto no-scrollbar">
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = tab === id;
          return (
            <Link
              key={id}
              href={tabHref(id)}
              className={cn(
                "inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        {tab !== "all" ? (
          <input type="hidden" name="direction" value={tab} />
        ) : null}
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="بحث بالموضوع..."
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
        />
        {profile.role === "md_admin" ? (
          <select
            name="companyId"
            defaultValue={companyId ?? ""}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
          >
            <option value="">كل الشركات</option>
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
          تصفية
        </button>
      </form>

      {!mails || mails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={
            tab === "inbound"
              ? "لا يوجد بريد وارد"
              : tab === "outbound"
                ? "لا يوجد بريد صادر"
                : "لا توجد رسائل"
          }
          description="ابدأ بتسجيل أول رسالة."
        />
      ) : (
        <>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {mails.map((m) => {
              const company = (
                m as typeof m & { companies?: { name_ar: string } | null }
              ).companies;
              const inbound = m.direction === "inbound";
              return (
                <li key={m.id}>
                  <Link
                    href={`/portal/mail/${m.id}`}
                    className="block p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div
                        className={
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 " +
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap sm:flex-nowrap">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                            {m.subject}
                          </h3>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {formatDate(m.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                          <span className="truncate">
                            {inbound
                              ? `من: ${m.from_name ?? "—"}`
                              : `إلى: ${m.to_name ?? "—"}`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {company?.name_ar ?? "—"}
                          </span>
                        </p>
                        {m.body ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                            {m.body}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <Pagination
          page={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          baseUrl="/portal/mail"
          extraParams={{
            ...(tab !== "all" ? { direction: tab } : {}),
            ...(companyId ? { companyId } : {}),
            ...(q ? { q } : {}),
          }}
        />
        </>
      )}
    </div>
  );
}
