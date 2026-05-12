import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReportRow = {
  id: string;
  report_date: string;
  work_done: string | null;
  notes: string | null;
  created_at: string;
  author: { full_name: string } | null;
  project: { name: string } | null;
};

export type ReportsData = {
  reports: ReportRow[];
  totalCount: number;
  projects: { id: string; name: string }[];
  engineers: { id: string; full_name: string }[] | null;
};

/**
 * Paginated engineer reports with filter dropdowns.
 * All filter params are explicit args (part of the cache key).
 * Revalidated by reports/actions.ts.
 */
export async function getReportsData(params: {
  profileId: string;
  isManager: boolean;
  page: number;
  pageSize: number;
  projectId?: string;
  authorId?: string;
  from?: string;
  to?: string;
  /** Scope manager lists to one company (MD Group manager / company manager). */
  filterCompanyId?: string;
}): Promise<ReportsData> {
  const supabase = await createSupabaseServerClient();
  const offset = (params.page - 1) * params.pageSize;

  let projectIdsInCompany: string[] | null = null;
  if (params.filterCompanyId) {
    const { data: pidRows } = await supabase
      .from("projects")
      .select("id")
      .eq("company_id", params.filterCompanyId);
    projectIdsInCompany = (pidRows ?? []).map((r) => r.id);
    if (projectIdsInCompany.length === 0) {
      let engineers: { id: string; full_name: string }[] | null = null;
      if (params.isManager) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "employee")
          .eq("is_active", true)
          .eq("company_id", params.filterCompanyId!)
          .order("full_name");
        engineers = data as { id: string; full_name: string }[] | null;
      }
      return {
        reports: [],
        totalCount: 0,
        projects: [],
        engineers,
      };
    }
  }

  let query = supabase
    .from("engineer_reports")
    .select(
      "id, report_date, work_done, notes, created_at, author:author_id(full_name), project:project_id(name)",
      { count: "exact" },
    )
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  if (!params.isManager) query = query.eq("author_id", params.profileId);
  if (params.projectId) query = query.eq("project_id", params.projectId);
  if (params.authorId) query = query.eq("author_id", params.authorId);
  if (params.from) query = query.gte("report_date", params.from);
  if (params.to) query = query.lte("report_date", params.to);
  if (projectIdsInCompany) query = query.in("project_id", projectIdsInCompany);

  let projectsQuery = supabase.from("projects").select("id, name").order("name");
  if (params.filterCompanyId) {
    projectsQuery = projectsQuery.eq("company_id", params.filterCompanyId);
  }

  const engineersQuery =
    params.isManager
      ? (() => {
          let q = supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "employee")
            .eq("is_active", true)
            .order("full_name");
          if (params.filterCompanyId) {
            q = q.eq("company_id", params.filterCompanyId);
          }
          return q;
        })()
      : Promise.resolve({ data: null });

  const [{ data: rawReports, count }, { data: projects }, { data: engineers }] =
    await Promise.all([query, projectsQuery, engineersQuery]);

  return {
    reports: (rawReports ?? []) as unknown as ReportRow[],
    totalCount: count ?? 0,
    projects: (projects ?? []) as { id: string; name: string }[],
    engineers: engineers as { id: string; full_name: string }[] | null,
  };
}
