import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DolceSignupInvitesSection } from "@/components/portal/DolceSignupInvitesSection";
import { canAccessDolceEmployeeSignup } from "@/lib/dolce-signup-company";
import { getCompanyData } from "@/lib/company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { ImageIcon, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SignupRequestActions } from "./signup-request-actions";
import { PassportArchiveToolbar } from "./passport-archive-toolbar";

export const metadata = { title: "طلبات التوظيف" };

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  external_employee_number: string | null;
  national_id: string | null;
  job_title: string | null;
  department: string | null;
  passport_image_path: string | null;
  created_at: string;
  company_id: string;
  companies: { name_ar: string } | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
};

const ROW_SELECT = `
  id,
  full_name,
  phone,
  external_employee_number,
  national_id,
  job_title,
  department,
  passport_image_path,
  created_at,
  company_id,
  status,
  rejection_reason,
  reviewed_at,
  companies ( name_ar )
`;

function mapRows(
  raw: {
    id: string;
    full_name: string | null;
    phone: string | null;
    external_employee_number: string | null;
    national_id: string | null;
    job_title: string | null;
    department: string | null;
    passport_image_path: string | null;
    created_at: string;
    company_id: string;
    companies: { name_ar: string } | { name_ar: string }[] | null;
    status: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
  }[],
): Row[] {
  return raw.map((r) => {
    const c = r.companies as { name_ar: string } | { name_ar: string }[] | null;
    const company = Array.isArray(c) ? c[0] ?? null : c;
    return {
      ...r,
      companies: company,
      status: r.status as Row["status"],
    };
  });
}

function StatusBadge({ status }: { status: "approved" | "rejected" }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        مقبول
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
      مرفوض
    </span>
  );
}

export default async function SignupRequestsPage() {
  const current = await requireRole(["md_admin", "company_manager"]);

  const shellId = await getShellCompanyIdForProfile(current.profile);

  if (!(await canAccessDolceEmployeeSignup(current.profile, shellId))) {
    redirect("/portal");
  }

  const queryCompanyId = current.profile.is_super_admin
    ? null
    : current.profile.role === "md_admin"
      ? shellId
      : current.profile.company_id;

  const activeCompany =
    queryCompanyId != null ? await getCompanyData(queryCompanyId) : null;

  const supabase = await createSupabaseServerClient();

  let pendingQuery = supabase
    .from("employee_signup_requests")
    .select(ROW_SELECT)
    .eq("status", "pending");

  let historyQuery = supabase
    .from("employee_signup_requests")
    .select(ROW_SELECT)
    .in("status", ["approved", "rejected"]);

  if (queryCompanyId) {
    pendingQuery = pendingQuery.eq("company_id", queryCompanyId);
    historyQuery = historyQuery.eq("company_id", queryCompanyId);
  }

  const [{ data: pendingRows }, { data: historyRows }] = await Promise.all([
    pendingQuery.order("created_at", { ascending: false }),
    historyQuery.order("reviewed_at", { ascending: false }),
  ]);

  const list = mapRows(pendingRows ?? []);
  const history = mapRows(historyRows ?? []);

  return (
    <div>
      <PageHeader
        title="طلبات التوظيف"
        description="مراجعة طلبات الانضمام من الموظفين الجدد. أدِر روابط الدعوة أو أنشئ رابطاً جديداً من القسم أدناه."
        action={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              href="/portal/employees"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              العودة للموظفين
            </Link>
          </div>
        }
      />

      {queryCompanyId && activeCompany ? (
        <DolceSignupInvitesSection
          companyId={queryCompanyId}
          companyNameAr={activeCompany.name_ar}
        />
      ) : null}

      <PassportArchiveToolbar />

      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
        قيد المراجعة
      </h2>

      {list.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="لا توجد طلبات قيد المراجعة"
          description="لا توجد طلبات قيد المراجعة حالياً. استخدم «إنشاء رابط دعوة» أعلاه ثم أرسل الرابط للموظف."
        />
      ) : (
        <div className="space-y-4 mb-10">
          <div className="md:hidden space-y-3">
            {list.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs space-y-3"
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {r.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {r.companies?.name_ar ?? "—"}
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="text-gray-400">رقم الموظف (خارجي): </span>
                    {r.external_employee_number ?? "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">الجوال: </span>
                    {r.phone ?? "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">الوظيفة / الفرع: </span>
                    {[r.job_title, r.department].filter(Boolean).join(" — ") ||
                      "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">التاريخ: </span>
                    {formatDate(r.created_at)}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-gray-400">صورة الجواز: </span>
                    {r.passport_image_path ? (
                      <Link
                        href={`/api/portal/employee-signup/passports/${r.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium underline-offset-2 hover:underline"
                      >
                        <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        عرض الصورة
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                </dl>
                <SignupRequestActions requestId={r.id} />
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-5 py-3 font-semibold">المتقدّم</th>
                    <th className="px-5 py-3 font-semibold">الشركة</th>
                    <th className="px-5 py-3 font-semibold">رقم الموظف (خارجي)</th>
                    <th className="px-5 py-3 font-semibold">الجوال</th>
                    <th className="px-5 py-3 font-semibold">الوظيفة / الفرع</th>
                    <th className="px-5 py-3 font-semibold">التاريخ</th>
                    <th className="px-5 py-3 font-semibold text-center">صورة</th>
                    <th className="px-5 py-3 font-semibold w-[220px]">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {r.full_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        {r.companies?.name_ar ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.external_employee_number ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.phone ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        <div>{r.job_title ?? "—"}</div>
                        {r.department ? (
                          <div className="text-xs text-gray-500">
                            الفرع: {r.department}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.passport_image_path ? (
                          <Link
                            href={`/api/portal/employee-signup/passports/${r.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            title="عرض صورة الجواز"
                            aria-label="عرض صورة الجواز"
                          >
                            <ImageIcon className="w-5 h-5" aria-hidden />
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <SignupRequestActions requestId={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 mt-2">
        السجل
      </h2>

      {history.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          لا توجد طلبات مقبولة أو مرفوضة بعد.
        </p>
      ) : (
        <div className="space-y-4 mb-8">
          <div className="md:hidden space-y-3">
            {history.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs space-y-3"
              >
                <div className="flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-50 truncate">
                      {r.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {r.companies?.name_ar ?? "—"}
                    </div>
                  </div>
                  <StatusBadge status={r.status as "approved" | "rejected"} />
                </div>
                <dl className="grid grid-cols-1 gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="text-gray-400">رقم الموظف (خارجي): </span>
                    {r.external_employee_number ?? "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">الجوال: </span>
                    {r.phone ?? "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">الوظيفة / الفرع: </span>
                    {[r.job_title, r.department].filter(Boolean).join(" — ") ||
                      "—"}
                  </div>
                  <div>
                    <span className="text-gray-400">تاريخ المراجعة: </span>
                    {r.reviewed_at ? formatDate(r.reviewed_at) : "—"}
                  </div>
                  {r.status === "rejected" && r.rejection_reason ? (
                    <div>
                      <span className="text-gray-400">سبب الرفض: </span>
                      {r.rejection_reason}
                    </div>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-5 py-3 font-semibold">المتقدّم</th>
                    <th className="px-5 py-3 font-semibold">الشركة</th>
                    <th className="px-5 py-3 font-semibold">الحالة</th>
                    <th className="px-5 py-3 font-semibold">رقم الموظف (خارجي)</th>
                    <th className="px-5 py-3 font-semibold">الجوال</th>
                    <th className="px-5 py-3 font-semibold">الوظيفة / الفرع</th>
                    <th className="px-5 py-3 font-semibold">تاريخ المراجعة</th>
                    <th className="px-5 py-3 font-semibold">سبب الرفض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {r.full_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        {r.companies?.name_ar ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={r.status as "approved" | "rejected"} />
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.external_employee_number ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.phone ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                        <div>{r.job_title ?? "—"}</div>
                        {r.department ? (
                          <div className="text-xs text-gray-500">
                            الفرع: {r.department}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.reviewed_at ? formatDate(r.reviewed_at) : "—"}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300 max-w-[200px]">
                        {r.status === "rejected" && r.rejection_reason
                          ? r.rejection_reason
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
