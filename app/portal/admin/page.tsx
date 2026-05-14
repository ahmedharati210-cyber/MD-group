import { Building2, Users, ShieldCheck, UserCog } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AppFeature, Company, RoleFeatures, UserRole } from "@/types/db";
import { PageHeader } from "@/components/portal/PageHeader";
import { FeatureToggleForm } from "./feature-toggle-form";
import { SuperAdminToggle } from "./super-admin-toggle";
import { UserEditForm } from "./user-edit-form";

export const metadata = { title: "لوحة الإدارة العليا" };

type ProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  job_title: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  companies: { name_ar: string } | null;
};

export default async function AdminPage() {
  const { userId } = await requireSuperAdmin();
  const supabase = await createSupabaseServerClient();

  const adminClient = createSupabaseAdminClient();

  const [companies, profilesResult, authResult] = await Promise.all([
    fetchCompaniesForDropdown<
      Pick<
        Company,
        "id" | "name_ar" | "name_en" | "active" | "enabled_features" | "role_features"
      >
    >(supabase, {
      columns: "id, name_ar, name_en, active, enabled_features, role_features",
    }),
    supabase
      .from("profiles")
      .select(
        "id, full_name, role, company_id, job_title, is_active, is_super_admin, companies:company_id(name_ar)",
      )
      .order("role")
      .order("full_name"),
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const rawProfiles = profilesResult.data;
  const authData = authResult.data;

  // Build id → email lookup from Supabase Auth
  const emailMap = new Map(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const profiles = (rawProfiles ?? []) as unknown as ProfileRow[];
  const companyList = companies.map((c) => ({
    id: c.id,
    name_ar: c.name_ar,
  }));

  // Group profiles by role for display
  const admins = profiles.filter((p) => p.role === "md_admin");
  const managers = profiles.filter((p) => p.role === "company_manager");
  const employees = profiles.filter((p) => p.role === "employee");

  const roleSection = (
    label: string,
    users: ProfileRow[],
    color: string,
  ) =>
    users.length === 0 ? null : (
      <div>
        <h3 className={`text-xs font-bold uppercase tracking-wider px-5 py-2 ${color}`}>
          {label} ({users.length})
        </h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((user) => {
            const isSelf = user.id === userId;
            return (
              <div
                key={user.id}
                className={`px-5 py-3 ${
                  isSelf ? "bg-violet-50/40 dark:bg-violet-900/10" : ""
                } ${
                  !user.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {user.full_name}
                      </span>
                      {isSelf ? (
                        <span className="text-xs text-violet-600 dark:text-violet-400">
                          (أنت)
                        </span>
                      ) : null}
                      {!user.is_active ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          · غير نشط
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user.companies?.name_ar ?? "بدون شركة"}
                      {user.job_title ? ` · ${user.job_title}` : ""}
                    </div>
                    {emailMap.get(user.id) ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                        {emailMap.get(user.id)}
                      </div>
                    ) : null}
                  </div>

                  {/* Edit form / role badge */}
                  <div className="sm:w-72 shrink-0">
                    <UserEditForm
                      profile={user}
                      companies={companyList}
                      isSelf={isSelf}
                      email={emailMap.get(user.id) ?? ""}
                    />
                  </div>

                  {/* Super admin toggle — md_admin only */}
                  {user.role === "md_admin" ? (
                    <div className="shrink-0">
                      <SuperAdminToggle
                        profileId={user.id}
                        fullName={user.full_name}
                        isSuperAdmin={user.is_super_admin}
                        isSelf={isSelf}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="space-y-10">
      <PageHeader
        title="لوحة الإدارة العليا"
        description="تحكم كامل في المستخدمين وميزات الشركات وصلاحيات المدراء."
      />

      {/* Super admin status banner */}
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700 rounded-xl">
        <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-bold text-violet-700 dark:text-violet-300">
          أنت تعمل بصلاحيات Super Admin — وصول كامل غير مقيّد
        </span>
      </div>

      {/* ================================================================== */}
      {/* Section 1: User Management                                          */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserCog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
              إدارة المستخدمين
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              اضغط على أيقونة القلم لتعديل دور المستخدم، شركته، مسماه الوظيفي،
              أو تعطيل حسابه.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {roleSection(
            "مدراء عامون",
            admins,
            "text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-900/10 border-b border-gray-100 dark:border-gray-800",
          )}
          {roleSection(
            "مدراء شركات",
            managers,
            "text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10 border-b border-gray-100 dark:border-gray-800",
          )}
          {roleSection(
            "موظفون",
            employees,
            "text-gray-600 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800",
          )}
          {profiles.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
              لا يوجد مستخدمون بعد.
            </p>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          لإضافة مستخدم جديد، اذهب إلى{" "}
          <a
            href="/portal/employees/new"
            className="text-primary-600 dark:text-primary-400 hover:underline"
          >
            الموظفون ← إضافة موظف
          </a>
          .
        </p>
      </section>

      {/* ================================================================== */}
      {/* Section 2: Company feature flags                                    */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
              ميزات الشركات
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              اختر الوحدات المتاحة لكل شركة. الميزات المُعطَّلة تُخفى
              تلقائياً من القائمة الجانبية لمستخدمي تلك الشركة.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(companies ?? []).map((company) => (
            <div
              key={company.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 shadow-sm ${
                company.active
                  ? "border-gray-200 dark:border-gray-800"
                  : "border-gray-100 dark:border-gray-800 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-gray-900 dark:text-gray-50">
                  {company.name_ar}
                </h3>
                {company.name_en ? (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    ({company.name_en})
                  </span>
                ) : null}
                {!company.active ? (
                  <span className="mr-auto text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-md">
                    غير نشطة
                  </span>
                ) : null}
              </div>
              <FeatureToggleForm
                companyId={company.id}
                companyName={company.name_ar}
                enabledFeatures={
                  (company.enabled_features as AppFeature[] | null) ?? null
                }
                roleFeatures={
                  (company.role_features as RoleFeatures | null) ?? null
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* Section 3: Super admin grants (md_admin only)                       */}
      {/* ================================================================== */}
      {admins.length > 0 ? (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
                صلاحيات Super Admin
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Super Admin يتجاوز جميع القيود ويصل لكل البيانات. يُمنح
                للمدراء العامين فقط.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                <tr className="text-right text-gray-600 dark:text-gray-400">
                  <th className="px-5 py-3 font-semibold">الاسم</th>
                  <th className="px-5 py-3 font-semibold">الشركة</th>
                  <th className="px-5 py-3 font-semibold">صلاحية Super Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {admins.map((admin) => {
                  const isSelf = admin.id === userId;
                  return (
                    <tr
                      key={admin.id}
                      className={
                        isSelf
                          ? "bg-violet-50/50 dark:bg-violet-900/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                      }
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {admin.full_name}
                        {isSelf ? (
                          <span className="mr-2 text-xs text-violet-600 dark:text-violet-400 font-normal">
                            (أنت)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {admin.companies?.name_ar ?? "مجموعة MD"}
                      </td>
                      <td className="px-5 py-3">
                        <SuperAdminToggle
                          profileId={admin.id}
                          fullName={admin.full_name}
                          isSuperAdmin={admin.is_super_admin}
                          isSelf={isSelf}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
