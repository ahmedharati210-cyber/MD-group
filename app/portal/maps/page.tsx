import Link from "next/link";
import { Plus, Map, MapPin, ExternalLink, Pencil } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { DeleteMapButton } from "@/components/maps/DeleteMapButton";

export const metadata = { title: "الخرائط" };

type MapRow = {
  id: string;
  name: string;
  description: string | null;
  drive_url: string;
  project: { name: string } | null;
};

export default async function MapsPage() {
  const { profile } = await requireFeature("maps");
  const supabase = await createSupabaseServerClient();
  const canManage = profile.role !== "employee";

  const { data: rawMaps } = await supabase
    .from("map_links")
    .select("id, name, description, drive_url, project:project_id(name)")
    .order("created_at", { ascending: false });

  const maps = (rawMaps ?? []) as unknown as MapRow[];

  return (
    <div>
      <PageHeader
        title="الخرائط"
        description="روابط خرائط Google Drive للمواقع الهندسية."
        action={
          canManage ? (
            <Link href="/portal/maps/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700">
              <Plus className="w-4 h-4" />
              خريطة جديدة
            </Link>
          ) : null
        }
      />

      {maps.length === 0 ? (
        <EmptyState icon={Map} title="لا توجد خرائط" description={canManage ? "أضف رابط خريطة." : "لم تُضف خرائط بعد."} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <div key={m.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Map className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">{m.name}</h3>
                </div>
                {canManage ? (
                  <div className="flex gap-1 flex-shrink-0">
                    <Link href={`/portal/maps/${m.id}/edit`} className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" aria-label="تعديل">
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <DeleteMapButton mapId={m.id} />
                  </div>
                ) : null}
              </div>

              {m.project ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="w-3.5 h-3.5" /> {m.project.name}
                </div>
              ) : null}

              {m.description ? <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{m.description}</p> : null}

              <a
                href={m.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                فتح الخريطة
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
