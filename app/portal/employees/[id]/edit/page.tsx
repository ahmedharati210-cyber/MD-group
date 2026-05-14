import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EditEmployeeForm } from "./edit-employee-form";
import { EditDirectoryForm } from "./edit-directory-form";
import type { EmployeeDirectoryRow } from "@/types/db";

export const metadata = { title: "تعديل موظف" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile: me } = await requireRole(["md_admin", "company_manager"]);
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, companies] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    fetchCompaniesForDropdown(supabase),
  ]);

  if (profile) {
    if (
      me.role === "company_manager" &&
      (profile.company_id !== me.company_id || profile.role !== "employee")
    ) {
      notFound();
    }

    const isAdmin = me.role === "md_admin";

    return (
      <div>
        <Link
          href={`/portal/employees/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى الملف
        </Link>
        <PageHeader title="تعديل المستخدم" description={profile.full_name} />
        <div className="max-w-3xl">
          <EditEmployeeForm
            profile={profile}
            companies={companies ?? []}
            canChangeRole={isAdmin}
            canChangeCompany={isAdmin}
            canSeeHrNotes={me.role === "md_admin" || me.role === "company_manager"}
          />
        </div>
      </div>
    );
  }

  const { data: dirRow } = await supabase
    .from("employee_directory")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!dirRow) notFound();

  const directoryRow = dirRow as unknown as EmployeeDirectoryRow;
  const companyId = directoryRow.company_id;

  const isScopedManager = me.role === "company_manager" && !me.is_super_admin;
  if (isScopedManager && me.company_id !== companyId) {
    notFound();
  }

  const canChangeCompany = me.role === "md_admin" || me.is_super_admin;

  return (
    <div>
      <Link
        href={`/portal/employees/${id}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الملف
      </Link>
      <PageHeader title="تعديل بيانات الموظف" description={directoryRow.full_name} />
      <div className="max-w-3xl">
        <EditDirectoryForm
          row={directoryRow}
          companies={companies ?? []}
          canChangeCompany={canChangeCompany}
        />
      </div>
    </div>
  );
}
