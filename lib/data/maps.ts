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
  filterCompanyId?: string;
}): Promise<MapsData> {
  const supabase = await createSupabaseServerClient();

  let mapsQuery = supabase
    .from("map_links")
    .select("id, name, description, drive_url, project_id, project:project_id(name)")
    .order("created_at", { ascending: false });

  if (params.filterCompanyId) {
    mapsQuery = mapsQuery.eq("company_id", params.filterCompanyId);
  }
  if (params.filterProjectId) {
    mapsQuery = mapsQuery.eq("project_id", params.filterProjectId);
  }
  if (params.filterQuery) {
    mapsQuery = mapsQuery.ilike("name", `%${params.filterQuery}%`);
  }

  let projectsQuery = supabase.from("projects").select("id, name").order("name");
  if (params.filterCompanyId) {
    projectsQuery = projectsQuery.eq("company_id", params.filterCompanyId);
  }

  const [mapsResult, projectsResult] = await Promise.all([
    mapsQuery,
    projectsQuery,
  ]);

  return {
    maps: (mapsResult.data ?? []) as unknown as MapRow[],
    projects: (projectsResult.data ?? []) as { id: string; name: string }[],
  };
}
