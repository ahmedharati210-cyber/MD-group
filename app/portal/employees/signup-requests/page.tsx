import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteLinkGenerator } from "@/components/portal/InviteLinkGenerator";
import {
  canAccessDolceEmployeeSignup,
  getDolceSignupCompanyDisplay,
  getDolceSignupCompanyId,
} from "@/lib/dolce-signup-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { UserPlus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SignupRequestActions } from "./signup-request-actions";

export const metadata = { title: "طلبات التوظيف" };

type Row = {
  id: string;
  full_name: string | null;
  phone: string | null;
  external_employee_number: string | null;
  national_id: string | null;
  job_title: string | null;
  department: string | null;
  created_at: string;
  company_id: string;
  companies: { name_ar: string } | null;
};

export default async function SignupRequestsPage() {
  const current = await requireRole(["md_admin", "company_manager"]);

  const [dolceId, dolceDisplay] = await Promise.all([
    getDolceSignupCompanyId(),
    getDolceSignupCompanyDisplay(),
  ]);

  if (
    !dolceId ||
    !canAccessDolceEmployeeSignup(current.profile, dolceId)
  ) {
    redirect("/portal");
  }

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("employee_signup_requests")
    .select(
      `
      id,
      full_name,
      phone,
      external_employee_number,
      national_id,
      job_title,
      department,
      created_at,
      company_id,
      companies ( name_ar )
    `,
    )
    .eq("status", "pending")
    .eq("company_id", dolceId)
    .order("created_at", { ascending: false });

  const raw = rows ?? [];
  const list: Row[] = raw.map((r) => {
    const c = r.companies as { name_ar: string } | { name_ar: string }[] | null;
    const company = Array.isArray(c) ? c[0] ?? null : c;
    return {
      ...r,
      companies: company,
    };
  });

  return (
    <div>
      <PageHeader
        title="طلبات التوظيف"
        description="مراجعة طلبات الانضمام من موظفي Dolce ضمن شركة الطريق الصحيح فقط. أنشئ رابط دعوة جديداً من القسم أدناه."
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

      {dolceDisplay ? (
        <InviteLinkGenerator companyNameAr={dolceDisplay.name_ar} />
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="لا توجد طلبات قيد المراجعة"
          description="طلبات شركة الطريق الصحيح فقط. استخدم «إنشاء رابط دعوة» أعلاه ثم أرسل الرابط للموظف."
        />
      ) : (
        <div className="space-y-4">
          <div className="md:hidden space-y-3">
            {list.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm space-y-3"
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
                </dl>
                <SignupRequestActions requestId={r.id} />
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
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
    </div>
  );
}
