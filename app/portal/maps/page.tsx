import Link from "next/link";
import { Plus, Map, MapPin, ExternalLink, Pencil, Building2 } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getMapsData } from "@/lib/data/maps";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { DeleteMapButton } from "@/components/maps/DeleteMapButton";
import { MapsFilter } from "@/components/maps/MapsFilter";

export const metadata = { title: "الخرائط" };

type MapRow = {
  id: string;
  name: string;
  description: string | null;
  drive_url: string;
  project_id: string | null;
  project: { name: string } | null;
};

export default async function MapsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireFeature("maps");
  const canManage = profile.role !== "employee";
  const scopeId = await getShellCompanyIdForProfile(profile);

  const sp = await searchParams;
  const filterProjectId = typeof sp.project_id === "string" ? sp.project_id : "";
  const filterQuery = typeof sp.q === "string" ? sp.q.trim() : "";
  const companyIdParam =
    typeof sp.companyId === "string" && sp.companyId.trim()
      ? sp.companyId.trim()
      : "";

  const filterCompanyId =
    profile.role === "company_manager"
      ? scopeId ?? undefined
      : companyIdParam || undefined;

  const { maps, projects } = await getMapsData({
    filterProjectId: filterProjectId || undefined,
    filterQuery: filterQuery || undefined,
    filterCompanyId,
  });

  let companiesForFilter: { id: string; name_ar: string }[] = [];
  if (
    canManage &&
    (profile.role === "md_admin" || (profile.is_super_admin ?? false))
  ) {
    const supabase = await createSupabaseServerClient();
    const companiesForFilterRaw = await fetchCompaniesForDropdown(supabase);
    companiesForFilter = companiesForFilterRaw;
  }

  const selectClasses =
    "px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none";

  return (
    <div>
      <PageHeader
        title="الخرائط"
        description="روابط خرائط Google Drive للمواقع الهندسية."
        action={
          canManage ? (
            <Link href="/portal/maps/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700">
              <Plus className="w-4 h-4" />
              خريطة جديدة
            </Link>
          ) : null
        }
      />

      {companiesForFilter.length > 0 ? (
        <form
          method="get"
          className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4"
        >
          {filterProjectId ? (
            <input type="hidden" name="project_id" value={filterProjectId} />
          ) : null}
          {filterQuery ? <input type="hidden" name="q" value={filterQuery} /> : null}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">الشركة</span>
          </div>
          <select
            name="companyId"
            defaultValue={companyIdParam}
            className={`flex-1 min-w-[12rem] ${selectClasses}`}
          >
            <option value="">كل الشركات</option>
            {companiesForFilter.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white"
          >
            تصفية
          </button>
        </form>
      ) : null}

      <MapsFilter
        projects={projects}
        currentProjectId={filterProjectId}
        currentQuery={filterQuery}
        currentCompanyId={companyIdParam}
      />

      {maps.length === 0 ? (
        <EmptyState icon={Map} title="لا توجد خرائط" description={filterProjectId || filterQuery ? "لا توجد خرائط تطابق الفلتر." : canManage ? "أضف رابط خريطة." : "لم تُضف خرائط بعد."} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <div key={m.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Map className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate">{m.name}</h3>
                </div>
                {canManage ? (
                  <div className="flex gap-1 flex-shrink-0">
                    <Link href={`/portal/maps/${m.id}/edit`} className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" aria-label="تعديل">
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <DeleteMapButton mapId={m.id} />
                  </div>
                ) : null}
              </div>

              {m.project ? (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="w-3.5 h-3.5" /> {m.project.name}
                </div>
              ) : null}

              {m.description ? <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{m.description}</p> : null}

              <a
                href={m.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                فتح الخريطة
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
