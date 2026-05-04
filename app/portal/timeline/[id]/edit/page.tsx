import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { ProjectForm } from "@/components/timeline/ProjectForm";

export const metadata = { title: "تعديل المشروع" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: project }, { data: engineers }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("profiles").select("id, full_name").eq("role", "employee").eq("is_active", true).order("full_name"),
  ]);

  if (!project) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="تعديل المشروع" description={project.name} />
      <ProjectForm
        project={project}
        engineers={(engineers ?? []) as { id: string; full_name: string }[]}
      />
    </div>
  );
}
