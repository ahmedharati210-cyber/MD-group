import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EditEmployeeForm } from "./edit-employee-form";

export const metadata = { title: "تعديل موظف" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile: me } = await requireRole(["md_admin", "company_manager"]);
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    supabase.from("companies").select("id, name_ar").order("name_ar"),
  ]);

  if (!profile) notFound();

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
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm max-w-3xl">
        <EditEmployeeForm
          profile={profile}
          companies={companies ?? []}
          canChangeRole={isAdmin}
          canChangeCompany={isAdmin}
        />
      </div>
    </div>
  );
}
