import Link from "next/link";
import { Plus, Receipt, CalendarDays, FileText, MapPin } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getClaimsData } from "@/lib/data/claims";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
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
  const { profile } = await requireFeature("claims", ["md_admin", "company_manager"]);
  const scopeId = await getShellCompanyIdForProfile(profile);

  const sp = await searchParams;
  const filterQuery = typeof sp.q === "string" ? sp.q.trim() : "";
  const filterProjectId = typeof sp.project_id === "string" ? sp.project_id : "";
  const companyIdParam =
    typeof sp.companyId === "string" && sp.companyId.trim()
      ? sp.companyId.trim()
      : "";

  const filterCompanyId =
    profile.role === "company_manager"
      ? scopeId ?? undefined
      : companyIdParam || undefined;

  const { claims, projects } = await getClaimsData({
    filterQuery: filterQuery || undefined,
    filterProjectId: filterProjectId || undefined,
    companyId: filterCompanyId,
  });

  const hasFilter = !!filterQuery || !!filterProjectId || !!companyIdParam;

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

      <ClaimsFilter
        projects={projects}
        currentQuery={filterQuery}
        currentProjectId={filterProjectId}
        currentCompanyId={companyIdParam}
      />

      {claims.length === 0 ? (
        <EmptyState icon={Receipt} title="لا توجد مطالبات" description={hasFilter ? "لا توجد مطالبات تطابق الفلتر." : "لم يتم إضافة مطالبات بعد."} />
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <Link key={c.id} href={`/portal/claims/${c.id}`} className="flex items-start gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
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
