import Link from "next/link";
import { FileText, Plus, Building2 } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getPapersData, type PaperDoc } from "@/lib/data/papers";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { bytesToReadable, formatDate } from "@/lib/utils";
import {
  paperExpiryVisualState,
  type PaperExpiryVisualState,
} from "@/lib/paper-expiry";
export const metadata = { title: "الأوراق الرسمية" };

const categoryLabel: Record<string, string> = {
  letter: "مراسلة",
  contract: "عقد",
  memo: "مذكرة",
  personal: "شخصي",
  other: "أخرى",
};

const expiryStatusLabel: Record<PaperExpiryVisualState, string> = {
  none: "—",
  ok: "سارية",
  expiring: "قرب الانتهاء",
  expired: "منتهية",
};

function expiryStatusClass(st: PaperExpiryVisualState): string {
  if (st === "expired") {
    return "text-red-600 dark:text-red-400 font-semibold";
  }
  if (st === "expiring") {
    return "text-amber-600 dark:text-amber-400 font-semibold";
  }
  if (st === "ok") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  return "text-gray-400 dark:text-gray-500";
}

type SearchParams = Promise<{
  q?: string;
  category?: string;
  companyId?: string;
}>;

export default async function PapersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireFeature("papers");
  const { q, category, companyId } = await searchParams;

  const canUpload = profile.role !== "employee";

  const effectiveCompanyId =
    companyId && companyId.length > 0 ? companyId : undefined;

  const { docs, companies } = await getPapersData({
    q: q || undefined,
    category: category || undefined,
    companyId: effectiveCompanyId || undefined,
  });

  const selectClasses =
    "px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

  return (
    <div>
      <PageHeader
        title="الأوراق الرسمية"
        description="إدارة العقود، المراسلات، المذكرات، والملفات الشخصية."
        action={
          canUpload ? (
            <Link
              href="/portal/papers/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              رفع ورقة
            </Link>
          ) : null
        }
      />

      <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="بحث في العنوان والمحتوى..."
          className="sm:col-span-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
        />
        <select
          name="category"
          defaultValue={category ?? "all"}
          className={selectClasses}
        >
          <option value="all">كل الأنواع</option>
          <option value="letter">مراسلة</option>
          <option value="contract">عقد</option>
          <option value="memo">مذكرة</option>
          <option value="personal">شخصي</option>
          <option value="other">أخرى</option>
        </select>
        {(profile.role === "md_admin" || profile.is_super_admin) ? (
          <select
            name="companyId"
            defaultValue={companyId ?? ""}
            className={selectClasses}
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          className="sm:col-span-2 lg:col-span-4 px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white"
        >
          تصفية
        </button>
      </form>

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="لا توجد أوراق"
          description={
            canUpload
              ? "ابدأ برفع أول ورقة رسمية."
              : "لم يتم مشاركة أي ورقة معك بعد."
          }
        />
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden space-y-3">
            {(docs as PaperDoc[]).map((d) => {
              const company = d.companies;
              const expSt = paperExpiryVisualState(d.expires_on ?? null);
              return (
                <Link
                  key={d.id}
                  href={`/portal/papers/${d.id}`}
                  className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-50 line-clamp-2">
                        {d.title}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">
                        النوع:{" "}
                      </span>
                      {categoryLabel[d.category]}
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">
                        الحجم:{" "}
                      </span>
                      {bytesToReadable(d.size_bytes)}
                    </div>
                    <div className="col-span-2 truncate">
                      <Building2 className="inline w-3 h-3 ml-1 text-gray-400 dark:text-gray-500" />
                      {company?.name_ar ?? "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        التاريخ:{" "}
                      </span>
                      {formatDate(d.created_at)}
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">
                        انتهاء الصلاحية:{" "}
                      </span>
                      {formatDate(d.expires_on) || "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        الحالة:{" "}
                      </span>
                      <span className={expiryStatusClass(expSt)}>
                        {expiryStatusLabel[expSt]}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-5 py-3 font-semibold">العنوان</th>
                    <th className="px-5 py-3 font-semibold">النوع</th>
                    <th className="px-5 py-3 font-semibold">الشركة</th>
                    <th className="px-5 py-3 font-semibold">الحجم</th>
                    <th className="px-5 py-3 font-semibold">تاريخ الرفع</th>
                    <th className="px-5 py-3 font-semibold">انتهاء الصلاحية</th>
                    <th className="px-5 py-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(docs as PaperDoc[]).map((d) => {
                    const company = d.companies;
                    const expSt = paperExpiryVisualState(d.expires_on ?? null);
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/portal/papers/${d.id}`}
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-700 dark:hover:text-primary-400 inline-flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {d.title}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          {categoryLabel[d.category]}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          <div className="inline-flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {company?.name_ar ?? "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {bytesToReadable(d.size_bytes)}
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {formatDate(d.created_at)}
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {formatDate(d.expires_on) || "—"}
                        </td>
                        <td className={`px-5 py-3 ${expiryStatusClass(expSt)}`}>
                          {expiryStatusLabel[expSt]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
