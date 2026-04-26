import Link from "next/link";
import { Users, Plus, Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "الموظفون" };

type SearchParams = Promise<{ companyId?: string; q?: string }>;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["md_admin", "company_manager"]);
  const { companyId, q } = await searchParams;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("profiles")
    .select("*, companies(id, name_ar)")
    .in("role", ["employee", "company_manager"])
    .order("created_at", { ascending: false });

  if (companyId) query = query.eq("company_id", companyId);
  if (q) query = query.ilike("full_name", `%${q}%`);

  const { data: employees } = await query;

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  return (
    <div>
      <PageHeader
        title="الموظفون"
        description="إدارة الموظفين والمدراء ضمن صلاحياتك."
        action={
          <Link
            href="/portal/employees/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            إضافة موظف
          </Link>
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
        <button
          type="submit"
          className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white"
        >
          تصفية
        </button>
      </form>

      {!employees || employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد موظفون"
          description="أضف أول موظف للبدء."
        />
      ) : (
        <>
          {/* Mobile list */}
          <div className="md:hidden space-y-3">
            {employees.map((e) => {
              const company = (
                e as typeof e & {
                  companies?: { id: string; name_ar: string } | null;
                }
              ).companies;
              return (
                <Link
                  key={e.id}
                  href={`/portal/employees/${e.id}`}
                  className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                        {e.full_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {e.role === "company_manager" ? "مدير شركة" : "موظف"}
                      </div>
                    </div>
                    <span
                      className={
                        e.is_active
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex-shrink-0"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex-shrink-0"
                      }
                    >
                      {e.is_active ? "نشط" : "غير نشط"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="truncate">
                      <span className="text-gray-400 dark:text-gray-500">
                        الوظيفة:{" "}
                      </span>
                      {e.job_title ?? "—"}
                    </div>
                    <div className="truncate">
                      <Building2 className="inline w-3 h-3 ml-1 text-gray-400 dark:text-gray-500" />
                      {company?.name_ar ?? "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        التوظيف:{" "}
                      </span>
                      {formatDate(e.hired_at) || "—"}
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
                    <th className="px-5 py-3 font-semibold">الاسم</th>
                    <th className="px-5 py-3 font-semibold">الوظيفة</th>
                    <th className="px-5 py-3 font-semibold">الشركة</th>
                    <th className="px-5 py-3 font-semibold">تاريخ التوظيف</th>
                    <th className="px-5 py-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {employees.map((e) => {
                    const company = (
                      e as typeof e & {
                        companies?: { id: string; name_ar: string } | null;
                      }
                    ).companies;
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/portal/employees/${e.id}`}
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-700 dark:hover:text-primary-400"
                          >
                            {e.full_name}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {e.role === "company_manager"
                              ? "مدير شركة"
                              : "موظف"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          {e.job_title ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          <div className="inline-flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {company?.name_ar ?? "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          {formatDate(e.hired_at) || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={
                              e.is_active
                                ? "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                : "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            }
                          >
                            {e.is_active ? "نشط" : "غير نشط"}
                          </span>
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
