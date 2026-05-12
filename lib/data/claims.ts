import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimRow = {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  file_url: string | null;
  created_at: string;
  project: { name: string } | null;
};

export type ClaimsData = {
  claims: ClaimRow[];
  projects: { id: string; name: string }[];
};

/**
 * Manager claims with optional title/project filters.
 * Claims and projects are fetched in parallel.
 * Revalidated by claims/actions.ts.
 */
export async function getClaimsData(params: {
  filterQuery?: string;
  filterProjectId?: string;
  /** When set, restrict claims and project list to this company. */
  companyId?: string;
}): Promise<ClaimsData> {
  const supabase = await createSupabaseServerClient();

  let dbQuery = supabase
    .from("manager_claims")
    .select(
      "id, title, description, amount, file_url, created_at, project:project_id(name)",
    )
    .order("created_at", { ascending: false });

  if (params.filterQuery) dbQuery = dbQuery.ilike("title", `%${params.filterQuery}%`);
  if (params.filterProjectId) dbQuery = dbQuery.eq("project_id", params.filterProjectId);
  if (params.companyId) dbQuery = dbQuery.eq("company_id", params.companyId);

  let projectsQuery = supabase.from("projects").select("id, name").order("name");
  if (params.companyId) projectsQuery = projectsQuery.eq("company_id", params.companyId);

  const [claimsResult, projectsResult] = await Promise.all([
    dbQuery,
    projectsQuery,
  ]);

  return {
    claims: (claimsResult.data ?? []) as unknown as ClaimRow[],
    projects: (projectsResult.data ?? []) as { id: string; name: string }[],
  };
}
