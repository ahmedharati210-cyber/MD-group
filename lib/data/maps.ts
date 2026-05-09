import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MapRow = {
  id: string;
  name: string;
  description: string | null;
  drive_url: string;
  project_id: string | null;
  project: { name: string } | null;
};

export type MapsData = {
  maps: MapRow[];
  projects: { id: string; name: string }[];
};

/**
 * Map links with optional project/name filters.
 * Revalidated by maps/actions.ts.
 */
export async function getMapsData(params: {
  filterProjectId?: string;
  filterQuery?: string;
}): Promise<MapsData> {
  const supabase = await createSupabaseServerClient();

  let mapsQuery = supabase
    .from("map_links")
    .select("id, name, description, drive_url, project_id, project:project_id(name)")
    .order("created_at", { ascending: false });

  if (params.filterProjectId) {
    mapsQuery = mapsQuery.eq("project_id", params.filterProjectId);
  }
  if (params.filterQuery) {
    mapsQuery = mapsQuery.ilike("name", `%${params.filterQuery}%`);
  }

  const [mapsResult, projectsResult] = await Promise.all([
    mapsQuery,
    supabase.from("projects").select("id, name").order("name"),
  ]);

  return {
    maps: (mapsResult.data ?? []) as unknown as MapRow[],
    projects: (projectsResult.data ?? []) as { id: string; name: string }[],
  };
}
