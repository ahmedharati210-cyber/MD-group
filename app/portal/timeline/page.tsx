import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { ProjectsGrid, type ProjectCardData } from "@/components/timeline/ProjectsGrid";

export const metadata = { title: " المشاريع" };

const PAGE_SIZE = 30;

type SearchParams = Promise<{ page?: string }>;

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireFeature("timeline");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createSupabaseServerClient();
  const canManage = profile.role !== "employee";

  const { data: rawProjects, count: totalCount } = await supabase
    .from("projects")
    .select(
      `
      id, name, description, start_date, end_date, status, location_notes,
      default_engineer:default_engineer_id(full_name),
      categories:project_categories(
        tasks:project_tasks(is_completed, due_date)
      )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const projects = (rawProjects ?? []) as unknown as ProjectCardData[];

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

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="لا توجد مشاريع"
          description={canManage ? "أضف أول مشروع هندسي." : "لم تُضف مشاريع بعد."}
        />
      ) : (
        <>
          <ProjectsGrid projects={projects} canManage={canManage} />
          {(totalCount ?? 0) > PAGE_SIZE && (
            <Pagination
              page={page}
              totalCount={totalCount ?? 0}
              pageSize={PAGE_SIZE}
              baseUrl="/portal/timeline"
            />
          )}
        </>
      )}
    </div>
  );
}
