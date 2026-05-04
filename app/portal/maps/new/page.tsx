import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { MapForm } from "@/components/maps/MapForm";

export const metadata = { title: "خريطة جديدة" };

export default async function NewMapPage() {
  await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("name");

  return (
    <div className="max-w-xl">
      <PageHeader title="خريطة جديدة" description="أضف رابط خريطة من Google Drive." />
      <MapForm projects={projects ?? []} />
    </div>
  );
}
