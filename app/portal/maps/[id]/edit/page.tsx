import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { MapForm } from "@/components/maps/MapForm";

export const metadata = { title: "تعديل الخريطة" };

export default async function EditMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();

  const [{ data: map }, { data: projects }] = await Promise.all([
    supabase.from("map_links").select("*").eq("id", id).single(),
    supabase.from("projects").select("id, name").order("name"),
  ]);

  if (!map) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title="تعديل الخريطة" description={map.name} />
      <MapForm map={map} projects={projects ?? []} />
    </div>
  );
}
