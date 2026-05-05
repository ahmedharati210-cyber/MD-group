import Link from "next/link";
import { Plus, Receipt, CalendarDays, FileText, MapPin } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { DeleteClaimButton } from "@/components/claims/DeleteClaimButton";
import { ClaimsFilter } from "@/components/claims/ClaimsFilter";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "المطالبات" };

type ClaimRow = {
  id: string;
  title: string;
  description: string | null;
  amount: number | null;
  file_url: string | null;
  created_at: string;
  project: { name: string } | null;
};

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireFeature("claims", ["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();

  const sp = await searchParams;
  const filterQuery = typeof sp.q === "string" ? sp.q.trim() : "";
  const filterProjectId = typeof sp.project_id === "string" ? sp.project_id : "";

  let dbQuery = supabase
    .from("manager_claims")
    .select("id, title, description, amount, file_url, created_at, project:project_id(name)")
    .order("created_at", { ascending: false });

  if (filterQuery) dbQuery = dbQuery.ilike("title", `%${filterQuery}%`);
  if (filterProjectId) dbQuery = dbQuery.eq("project_id", filterProjectId);

  const [claimsResult, projectsResult] = await Promise.all([
    dbQuery,
    supabase.from("projects").select("id, name").order("name"),
  ]);

  const claims = (claimsResult.data ?? []) as unknown as ClaimRow[];
  const projects = (projectsResult.data ?? []) as { id: string; name: string }[];

  const hasFilter = !!filterQuery || !!filterProjectId;

  return (
    <div>
      <PageHeader
        title="المطالبات"
        description="مطالبات الشركة — وثائق PDF خاصة بالإدارة."
        action={
          <Link href="/portal/claims/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700">
            <Plus className="w-4 h-4" />
            مطالبة جديدة
          </Link>
        }
      />

      <ClaimsFilter projects={projects} currentQuery={filterQuery} currentProjectId={filterProjectId} />

      {claims.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد مطالبات" description={hasFilter ? "لا توجد مطالبات تطابق الفلتر." : "لم يتم إضافة مطالبات بعد."} />
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Link key={c.id} href={`/portal/claims/${c.id}`} className="flex items-start gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">{c.title}</h3>
                    {c.description ? <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{c.description}</p> : null}
                  </div>
                  <DeleteClaimButton claimId={c.id} />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {c.amount != null ? (
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {Number(c.amount).toLocaleString("ar-LY")} ل.د
                    </span>
                  ) : null}
                  {c.project ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5" /> {c.project.name}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <CalendarDays className="w-3.5 h-3.5" /> {formatDate(c.created_at)}
                  </span>
                  {c.file_url ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 font-medium">
                      <FileText className="w-3.5 h-3.5" /> يحتوي على PDF
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
