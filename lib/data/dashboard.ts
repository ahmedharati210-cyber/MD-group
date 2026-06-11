import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
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

const EMPTY_DASHBOARD: DashboardData = {
  counts: {
    companies: 0, employees: 0, attendanceToday: 0, papers: 0, mail: 0,
    contacts: 0, projects: 0, pendingRequests: 0, overdueTasks: 0, warnings: 0,
  },
  topProjects: [],
};

/**
 * Creates a Supabase client authenticated with a bearer token.
 * Safe to use inside `unstable_cache` callbacks where cookies are unavailable.
 * The token carries the user's identity so RLS still applies.
 */
function createTokenClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

function dashboardCacheKey(profileId: string, isEmployee: boolean): string {
  return `dashboard-${profileId}-${isEmployee}`;
}

async function fetchDashboardData(
  profileId: string,
  isEmployee: boolean,
  accessToken: string,
): Promise<DashboardData> {
  const supabase = createTokenClient(accessToken);
  const today = new Date().toISOString().slice(0, 10);

  const requestsBase = supabase
    .from("engineer_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const requestsQuery = isEmployee
    ? requestsBase.eq("requester_id", profileId)
    : requestsBase;

  const warningsQuery = isEmployee
    ? supabase
        .from("warnings")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .or(`target_profile_id.eq.${profileId},target_profile_id.is.null`)
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

const dashboardCacheRunners = new Map<string, (accessToken: string) => Promise<DashboardData>>();

function getDashboardCacheRunner(
  profileId: string,
  isEmployee: boolean,
): (accessToken: string) => Promise<DashboardData> {
  const cacheKey = dashboardCacheKey(profileId, isEmployee);
  let runner = dashboardCacheRunners.get(cacheKey);
  if (!runner) {
    runner = (accessToken: string) =>
      unstable_cache(
        () => fetchDashboardData(profileId, isEmployee, accessToken),
        [cacheKey],
        { revalidate: 60, tags: ["dashboard"] },
      )();
    dashboardCacheRunners.set(cacheKey, runner);
  }
  return runner;
}

function fetchDashboardCached(
  profileId: string,
  isEmployee: boolean,
  accessToken: string,
): Promise<DashboardData> {
  return getDashboardCacheRunner(profileId, isEmployee)(accessToken);
}

/**
 * Cached dashboard stats — 11 parallel count queries + top 3 active projects.
 * Two-layer cache:
 *  - React cache() deduplicates repeated calls within the same render tree.
 *  - unstable_cache with 60 s TTL serves stale data across requests so the DB
 *    is hit at most once per minute per user. Tag "dashboard" lets Server
 *    Actions call revalidateTag("dashboard") after mutations.
 */
export const getDashboardData = cache(
  async (params: {
    profileId: string;
    isEmployee: boolean;
  }): Promise<DashboardData> => {
    const cookieClient = await createSupabaseServerClient();
    const {
      data: { session },
    } = await cookieClient.auth.getSession();
    if (!session) return EMPTY_DASHBOARD;

    return fetchDashboardCached(params.profileId, params.isEmployee, session.access_token);
  },
);
