import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types/db";

export type DashboardCounts = {
  companies: number;
  employees: number;
  attendanceToday: number;
  papers: number;
  mail: number;
  contacts: number;
  projects: number;
  pendingRequests: number;
  overdueTasks: number;
  warnings: number;
};

export type ProjectProgressRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  categories: { tasks: { is_completed: boolean }[] }[];
};

export type DashboardData = {
  counts: DashboardCounts;
  topProjects: ProjectProgressRow[];
};

/**
 * Cached dashboard stats — 10 parallel count queries + top 3 active projects.
 * Stale-while-revalidate: serve cached data for up to 60s, refresh every 5min.
 * Invalidated by any Server Action that changes a counted resource.
 */
export async function getDashboardData(params: {
  profileId: string;
  isEmployee: boolean;
}): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const requestsBase = supabase
    .from("engineer_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const requestsQuery = params.isEmployee
    ? requestsBase.eq("requester_id", params.profileId)
    : requestsBase;

  const warningsQuery = params.isEmployee
    ? supabase
        .from("warnings")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .or(`target_profile_id.eq.${params.profileId},target_profile_id.is.null`)
    : supabase.from("warnings").select("id", { count: "exact", head: true });

  const [
    companies,
    employees,
    attendance,
    papers,
    mail,
    contacts,
    projects,
    requests,
    overdue,
    warnings,
    topProjectsResult,
  ] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employee"),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("mail").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    requestsQuery,
    supabase
      .from("project_tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .not("due_date", "is", null)
      .lt("due_date", today),
    warningsQuery,
    supabase
      .from("projects")
      .select("id, name, status, categories:project_categories(tasks:project_tasks(is_completed))")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return {
    counts: {
      companies: companies.count ?? 0,
      employees: employees.count ?? 0,
      attendanceToday: attendance.count ?? 0,
      papers: papers.count ?? 0,
      mail: mail.count ?? 0,
      contacts: contacts.count ?? 0,
      projects: projects.count ?? 0,
      pendingRequests: requests.count ?? 0,
      overdueTasks: overdue.count ?? 0,
      warnings: warnings.count ?? 0,
    },
    topProjects: (topProjectsResult.data ?? []) as unknown as ProjectProgressRow[],
  };
}
