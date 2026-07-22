import { notFound, redirect } from "next/navigation";
import { requireTestingAccess } from "@/lib/auth";
import { canManageTesting } from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { QaProjectForm } from "@/components/testing/QaProjectForm";
import type { QaProject } from "@/types/db";

export const metadata = { title: "تعديل منصة" };

export default async function EditQaProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireTestingAccess();
  if (!canManageTesting(profile)) redirect(`/portal/testing/${id}`);

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("qa_projects")
    .select("id, company_id, name, description, status, created_by, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="تعديل المنصة" />
      <QaProjectForm project={data as QaProject} />
    </div>
  );
}
