import Link from "next/link";
import { Plus, FileBarChart2, CalendarDays, MapPin, User } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";

export const metadata = { title: "التقارير" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{ projectId?: string; authorId?: string; from?: string; to?: string; page?: string }>;

type ReportRow = {
  id: string;
  report_date: string;
  work_done: string | null;
  created_at: string;
  author: { full_name: string } | null;
  project: { name: string } | null;
};

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { profile } = await requireFeature("reports");
  const supabase = await createSupabaseServerClient();
  const isManager = profile.role !== "employee";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("engineer_reports")
    .select("id, report_date, work_done, created_at, author:author_id(full_name), project:project_id(name)", { count: "exact" })
    .order("report_date", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!isManager) query = query.eq("author_id", profile.id ?? "");
  if (sp.projectId) query = query.eq("project_id", sp.projectId);
  if (sp.authorId) query = query.eq("author_id", sp.authorId);
  if (sp.from) query = query.gte("report_date", sp.from);
  if (sp.to) query = query.lte("report_date", sp.to);

  const { data: rawReports, count } = await query;
  const reports = (rawReports ?? []) as unknown as ReportRow[];
  const totalCount = count ?? 0;

  const [{ data: projects }, { data: engineers }] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    isManager
      ? supabase.from("profiles").select("id, full_name").eq("role", "employee").eq("is_active", true).order("full_name")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <PageHeader
        title="التقارير"
        description="التقارير اليومية والأسبوعية للمهندسين."
        action={
          <Link href="/portal/reports/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700">
            <Plus className="w-4 h-4" />
            تقرير جديد
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <form method="get" className="flex flex-wrap gap-3">
          {projects && projects.length > 0 ? (
            <select name="projectId" defaultValue={sp.projectId ?? ""} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none">
              <option value="">كل المشاريع</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : null}
          {isManager && engineers ? (
            <select name="authorId" defaultValue={sp.authorId ?? ""} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none">
              <option value="">كل المهندسين</option>
              {engineers.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          ) : null}
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none" />
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none" />
          <button type="submit" className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors">
            تصفية
          </button>
          {(sp.projectId || sp.authorId || sp.from || sp.to) ? (
            <Link href="/portal/reports" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              مسح
            </Link>
          ) : null}
        </form>
      </div>

      {reports.length === 0 ? (
        <EmptyState icon={FileBarChart2} title="لا توجد تقارير" description="لم يتم إضافة تقارير بعد." />
      ) : (
        <>
          <div className="space-y-3">
            {reports.map((r) => (
              <Link key={r.id} href={`/portal/reports/${r.id}`} className="flex items-start gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all">
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileBarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <CalendarDays className="w-3.5 h-3.5" /> {r.report_date}
                    </span>
                    {r.project ? (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3.5 h-3.5" />{r.project.name}
                      </span>
                    ) : null}
                    {isManager && r.author ? (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <User className="w-3.5 h-3.5" />{r.author.full_name}
                      </span>
                    ) : null}
                  </div>
                  {r.work_done ? <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{r.work_done}</p> : null}
                </div>
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            baseUrl="/portal/reports"
            extraParams={{
              ...(sp.projectId ? { projectId: sp.projectId } : {}),
              ...(sp.authorId ? { authorId: sp.authorId } : {}),
              ...(sp.from ? { from: sp.from } : {}),
              ...(sp.to ? { to: sp.to } : {}),
            }}
          />
        </>
      )}
    </div>
  );
}
