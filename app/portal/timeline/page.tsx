import Link from "next/link";
import { Plus, FolderKanban, Archive } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { ProjectsGrid, type ProjectCardData } from "@/components/timeline/ProjectsGrid";

export const metadata = { title: " المشاريع" };

const PAGE_SIZE = 30;

type SearchParams = Promise<{ page?: string; donePage?: string; companyId?: string }>;

const PROJECT_SELECT = `
  id, name, description, start_date, end_date, status, location_notes,
  default_engineer:default_engineer_id(full_name),
  categories:project_categories(
    id, name, sort_order,
    tasks:project_tasks(id, title, is_completed, due_date, sort_order)
  )
`;

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireFeature("timeline");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const donePage = Math.max(1, Number(sp.donePage ?? 1));
  const activeFrom = (page - 1) * PAGE_SIZE;
  const activeTo = activeFrom + PAGE_SIZE - 1;
  const doneFrom = (donePage - 1) * PAGE_SIZE;
  const doneTo = doneFrom + PAGE_SIZE - 1;

  const scopeId = await getShellCompanyIdForProfile(profile);
  const companyIdParam =
    typeof sp.companyId === "string" && sp.companyId.trim()
      ? sp.companyId.trim()
      : null;

  const projectCompanyId =
    profile.role === "company_manager"
      ? scopeId
      : profile.role === "md_admin" || profile.role === "owner" || (profile.is_super_admin ?? false)
        ? companyIdParam
        : scopeId;

  const supabase = await createSupabaseServerClient();
  const canManage = profile.role !== "employee" && profile.role !== "owner";

  const applyCompanyScope = <T extends { eq: (col: string, val: string) => T }>(query: T) =>
    projectCompanyId ? query.eq("company_id", projectCompanyId) : query;

  const activeQuery = applyCompanyScope(
    supabase
      .from("projects")
      .select(PROJECT_SELECT, { count: "exact" })
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .range(activeFrom, activeTo),
  );

  const doneQuery = applyCompanyScope(
    supabase
      .from("projects")
      .select(PROJECT_SELECT, { count: "exact" })
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .range(doneFrom, doneTo),
  );

  const [{ data: rawActiveProjects, count: activeCount }, { data: rawDoneProjects, count: doneCount }] =
    await Promise.all([activeQuery, doneQuery]);

  const activeProjects = (rawActiveProjects ?? []) as unknown as ProjectCardData[];
  const doneProjects = (rawDoneProjects ?? []) as unknown as ProjectCardData[];

  const paginationExtraParams = {
    ...(companyIdParam ? { companyId: companyIdParam } : {}),
    ...(donePage > 1 ? { donePage: String(donePage) } : {}),
  };

  const donePaginationExtraParams = {
    ...(companyIdParam ? { companyId: companyIdParam } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  };

  const hasNoProjects = activeProjects.length === 0 && doneProjects.length === 0;

  return (
    <div>
      <PageHeader
        title="المشاريع"
        description="متابعة المشاريع الهندسية ومهام كل موقع."
        action={
          canManage ? (
            <Link
              href="/portal/timeline/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              مشروع جديد
            </Link>
          ) : null
        }
      />

      {hasNoProjects ? (
        <EmptyState
          icon={FolderKanban}
          title="لا توجد مشاريع"
          description={canManage ? "أضف أول مشروع هندسي." : "لم تُضف مشاريع بعد."}
        />
      ) : (
        <div className="space-y-10">
          {activeProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="لا توجد مشاريع نشطة"
              description={canManage ? "جميع المشاريع منتهية أو لم تُضف مشاريع بعد." : "لا توجد مشاريع قيد التنفيذ حالياً."}
            />
          ) : (
            <>
              <ProjectsGrid projects={activeProjects} canManage={canManage} />
              {(activeCount ?? 0) > PAGE_SIZE && (
                <Pagination
                  page={page}
                  totalCount={activeCount ?? 0}
                  pageSize={PAGE_SIZE}
                  baseUrl="/portal/timeline"
                  extraParams={paginationExtraParams}
                />
              )}
            </>
          )}

          {doneProjects.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-800 pt-8">
                <Archive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
                  المشاريع المنجزة
                  <span className="ms-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    ({doneCount ?? doneProjects.length})
                  </span>
                </h2>
              </div>

              <ProjectsGrid
                projects={doneProjects}
                canManage={canManage}
                isDoneSection
              />

              {(doneCount ?? 0) > PAGE_SIZE && (
                <Pagination
                  page={donePage}
                  totalCount={doneCount ?? 0}
                  pageSize={PAGE_SIZE}
                  baseUrl="/portal/timeline"
                  pageParam="donePage"
                  extraParams={donePaginationExtraParams}
                />
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
