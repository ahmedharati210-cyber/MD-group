import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { ProjectForm } from "@/components/timeline/ProjectForm";

export const metadata = { title: "مشروع جديد" };

export default async function NewProjectPage() {
  await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { data: engineers } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "employee")
    .eq("is_active", true)
    .order("full_name");

  return (
    <div className="max-w-xl">
      <PageHeader title="مشروع / موقع جديد" description="أضف مشروعاً هندسياً جديداً مع بيانات الموقع." />
      <ProjectForm engineers={(engineers ?? []) as { id: string; full_name: string }[]} />
    </div>
  );
}
