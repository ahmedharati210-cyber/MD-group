import Link from "next/link";
import { Users, Plus, Building2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "الموظفون" };

const PAGE_SIZE = 50;
/** Cap per source before merge; avoids unbounded loads. */
const MERGE_FETCH_LIMIT = 2_000;

type SearchParams = Promise<{ companyId?: string; q?: string; page?: string; error?: string }>;

type CompanyJoin = { id: string; name_ar: string } | null;

/** Supabase may return embedded `companies` as object or single-element array. */
function companyFromJoin(embedded: unknown): CompanyJoin {
  if (!embedded) return null;
  if (Array.isArray(embedded)) {
    const first = embedded[0];
    return first && typeof first === "object" && "name_ar" in first
      ? (first as { id: string; name_ar: string })
      : null;
  }
  if (typeof embedded === "object" && embedded !== null && "name_ar" in embedded) {
    return embedded as { id: string; name_ar: string };
  }
  return null;
}

type ProfileRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  hired_at: string | null;
  is_active: boolean;
  role: string;
  created_at: string;
  companies?: unknown;
};

type DirectoryRow = {
  id: string;
  full_name: string;
  job_title: string | null;
  hired_at: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
  companies?: unknown;
};

type UnifiedRow =
  | { kind: "portal"; sortAt: string; data: ProfileRow }
  | { kind: "hr"; sortAt: string; data: DirectoryRow };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["md_admin", "company_manager"]);
  const { companyId, q, page: pageParam, error: listError } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  let profilesQuery = supabase
    .from("profiles")
    .select(
      "id, full_name, job_title, hired_at, is_active, role, created_at, companies(id, name_ar)",
    )
    .in("role", ["employee", "company_manager"])
    .order("created_at", { ascending: false })
    .limit(MERGE_FETCH_LIMIT);

  if (companyId) profilesQuery = profilesQuery.eq("company_id", companyId);
  if (q) profilesQuery = profilesQuery.ilike("full_name", `%${q}%`);

  let directoryQuery = supabase
    .from("employee_directory")
    .select(
      "id, full_name, job_title, hired_at, contact_email, is_active, created_at, companies(id, name_ar)",
    )
    .is("linked_profile_id", null)
    .order("created_at", { ascending: false })
    .limit(MERGE_FETCH_LIMIT);

  if (companyId) directoryQuery = directoryQuery.eq("company_id", companyId);
  if (q) directoryQuery = directoryQuery.ilike("full_name", `%${q}%`);

  const [{ data: profileRows }, companies, { data: directoryRows }] =
    await Promise.all([
      profilesQuery,
      fetchCompaniesForDropdown(supabase),
      directoryQuery,
    ]);

  const profiles = (profileRows ?? []) as unknown as ProfileRow[];
  const directories = (directoryRows ?? []) as unknown as DirectoryRow[];

  const merged: UnifiedRow[] = [
    ...profiles.map((data) => ({
      kind: "portal" as const,
      sortAt: data.created_at,
      data,
    })),
    ...directories.map((data) => ({
      kind: "hr" as const,
      sortAt: data.created_at,
      data,
    })),
  ].sort(
    (a, b) =>
      new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
  );

  const totalCount = merged.length;
  const pageRows = merged.slice(from, from + PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="الموظفون"
        description="إدارة الموظفين ضمن صلاحياتك."
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

      {listError ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {listError}
        </div>
      ) : null}

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

      {totalCount === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد موظفون"
          description="أضف موظفاً للبدء."
        />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {pageRows.map((item) => {
              if (item.kind === "portal") {
                const e = item.data;
                const company = companyFromJoin(e.companies);
                return (
                  <Link
                    key={`p-${e.id}`}
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
              }

              const row = item.data;
              const company = companyFromJoin(row.companies);
              return (
                <Link
                  key={`d-${row.id}`}
                  href={`/portal/employees/${row.id}`}
                  className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                        {row.full_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        موظف
                      </div>
                    </div>
                    <span
                      className={
                        row.is_active
                          ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex-shrink-0"
                          : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex-shrink-0"
                      }
                    >
                      {row.is_active ? "نشط" : "غير نشط"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className="truncate">
                      <span className="text-gray-400 dark:text-gray-500">
                        الوظيفة:{" "}
                      </span>
                      {row.job_title ?? "—"}
                    </div>
                    <div className="truncate">
                      <Building2 className="inline w-3 h-3 ml-1 text-gray-400 dark:text-gray-500" />
                      {company?.name_ar ?? "—"}
                    </div>
                    <div className="col-span-2 truncate" dir="ltr">
                      <span className="text-gray-400 dark:text-gray-500">
                        بريد مراسلة:{" "}
                      </span>
                      {row.contact_email ?? "—"}
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 dark:text-gray-500">
                        التوظيف:{" "}
                      </span>
                      {formatDate(row.hired_at) || "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-5 py-3 font-semibold">الاسم</th>
                    <th className="px-5 py-3 font-semibold">الوظيفة</th>
                    <th className="px-5 py-3 font-semibold">الشركة</th>
                    <th className="px-5 py-3 font-semibold">بريد مراسلة</th>
                    <th className="px-5 py-3 font-semibold">تاريخ التوظيف</th>
                    <th className="px-5 py-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pageRows.map((item) => {
                    if (item.kind === "portal") {
                      const e = item.data;
                      const company = companyFromJoin(e.companies);
                      return (
                        <tr
                          key={`p-${e.id}`}
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
                          <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                            —
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
                    }

                    const row = item.data;
                    const company = companyFromJoin(row.companies);
                    return (
                      <tr
                        key={`d-${row.id}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/portal/employees/${row.id}`}
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-700 dark:hover:text-primary-400"
                          >
                            {row.full_name}
                          </Link>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            موظف
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          {row.job_title ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          <div className="inline-flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            {company?.name_ar ?? "—"}
                          </div>
                        </td>
                        <td
                          className="px-5 py-3 text-gray-700 dark:text-gray-300 truncate max-w-[12rem]"
                          dir="ltr"
                        >
                          {row.contact_email ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                          {formatDate(row.hired_at) || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={
                              row.is_active
                                ? "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                : "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            }
                          >
                            {row.is_active ? "نشط" : "غير نشط"}
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

      {totalCount > PAGE_SIZE && (
        <Pagination
          page={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          baseUrl="/portal/employees"
          extraParams={{
            ...(q ? { q } : {}),
            ...(companyId ? { companyId } : {}),
          }}
        />
      )}
    </div>
  );
}
