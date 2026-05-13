import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { PersonalDraftsCreateForm } from "@/components/timeline/PersonalDraftsCreateForm";
import { PersonalDraftRow } from "@/components/timeline/PersonalDraftRow";
import type { ProjectPersonalDraft } from "@/types/db";

export const metadata = { title: "مسوداتي — المشاريع" };

type SearchParams = Promise<{ companyId?: string }>;

function formatDateTime(iso: string) {
  try {
    // `nu-latn`: keep Arabic calendar/wording where applicable but use Western digits (2026 not ٢٠٢٦).
    return new Date(iso).toLocaleString("ar-SA-u-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type ProjectWithCats = {
  id: string;
  name: string;
  company_id: string;
  categories: { id: string; name: string; sort_order: number }[] | null;
};

type DraftWithProject = ProjectPersonalDraft & {
  projects: { id: string; name: string; company_id: string } | null;
};

export default async function PersonalDraftsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireFeature("timeline", ["md_admin"]);
  const sp = await searchParams;
  const companyIdParam =
    typeof sp.companyId === "string" && sp.companyId.trim()
      ? sp.companyId.trim()
      : null;

  const scopeId = await getShellCompanyIdForProfile(profile);
  const projectCompanyId =
    profile.role === "company_manager"
      ? scopeId
      : profile.role === "md_admin" || (profile.is_super_admin ?? false)
        ? companyIdParam
        : scopeId;

  const supabase = await createSupabaseServerClient();
  const isSuper = profile.is_super_admin ?? false;
  const showCreate = profile.role === "md_admin";

  let projectQuery = supabase
    .from("projects")
    .select(
      `
      id,
      name,
      company_id,
      categories:project_categories(id, name, sort_order)
    `,
    )
    .order("name", { ascending: true });

  if (projectCompanyId) projectQuery = projectQuery.eq("company_id", projectCompanyId);

  const { data: rawProjects } = await projectQuery;
  const projects = (rawProjects ?? []) as unknown as ProjectWithCats[];

  const projectsForForm = projects.map((p) => ({
    id: p.id,
    name: p.name,
    categories: [...(p.categories ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }));

  const { data: rawDrafts } = await supabase
    .from("project_personal_drafts")
    .select(
      `
      id,
      author_id,
      project_id,
      category_id,
      body,
      created_at,
      updated_at,
      projects ( id, name, company_id )
    `,
    )
    .order("created_at", { ascending: false });

  let drafts = (rawDrafts ?? []) as unknown as DraftWithProject[];

  if (projectCompanyId) {
    drafts = drafts.filter(
      (d) => d.projects?.company_id && d.projects.company_id === projectCompanyId,
    );
  }

  const authorIds = [...new Set(drafts.map((d) => d.author_id))];
  const authorNameById: Record<string, string> = {};
  if (isSuper && authorIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const row of profs ?? []) {
      const r = row as { id: string; full_name: string | null };
      authorNameById[r.id] = r.full_name?.trim() || "—";
    }
  }

  const categoryNameByKey: Record<string, string> = {};
  for (const p of projects) {
    for (const c of p.categories ?? []) {
      categoryNameByKey[`${p.id}:${c.id}`] = c.name;
    }
  }

  return (
    <div>
      <PageHeader
        title={isSuper ? "مسودات المشاريع (جميع المستخدمين)" : "مسوداتي"}
        description={
          isSuper
            ? "عرض جميع المسودات الخاصة بمديري المجموعة — لا يراها سوى صاحب المسودة وأنت."
            : "ملاحظات خاصة بك على مشاريع إعمار مرتبطة بالمشروع والمرحلة. لا يراها أحد غيرك ومشرف النظام."
        }
      />

      <div className="space-y-8 mt-6">
        {showCreate ? <PersonalDraftsCreateForm projects={projectsForForm} /> : null}

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
            {isSuper ? "كل المسودات" : "مسوداتي المحفوظة"}
          </h2>
          {drafts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">
              لا توجد مسودات بعد.
            </p>
          ) : (
            <ul className="space-y-4">
              {drafts.map((d) => {
                const projectName = d.projects?.name ?? "مشروع محذوف";
                const catName =
                  d.category_id && d.projects
                    ? categoryNameByKey[`${d.project_id}:${d.category_id}`] ?? null
                    : null;
                const isAuthor = d.author_id === profile.id;
                return (
                  <li key={d.id}>
                    <PersonalDraftRow
                      id={d.id}
                      body={d.body}
                      createdAtLabel={formatDateTime(d.created_at)}
                      updatedAtLabel={formatDateTime(d.updated_at)}
                      projectName={projectName}
                      categoryLabel={catName}
                      authorLabel={isSuper ? (authorNameById[d.author_id] ?? "—") : null}
                      canEdit={isAuthor}
                      canDelete={isAuthor || isSuper}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
