import Link from "next/link";
import { Plus, AppWindow, Archive } from "lucide-react";
import { requireTestingAccess } from "@/lib/auth";
import { canManageTesting, getItqanCompanyId } from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import {
  QaProjectsGrid,
  type QaProjectCardData,
} from "@/components/testing/QaProjectsGrid";

export const metadata = { title: "المنظومات والمواقع" };

const PROJECT_SELECT = `
  id, name, description, status,
  sections:qa_sections(
    id, name, sort_order,
    items:qa_test_items(id, title, result, item_kind, sort_order)
  )
`;

export default async function TestingPage() {
  const { profile } = await requireTestingAccess();
  const canManage = canManageTesting(profile);
  const companyId = await getItqanCompanyId();

  const supabase = await createSupabaseServerClient();

  let activeProjects: QaProjectCardData[] = [];
  let doneProjects: QaProjectCardData[] = [];

  if (companyId) {
    const [{ data: rawActive }, { data: rawDone }] = await Promise.all([
      supabase
        .from("qa_projects")
        .select(PROJECT_SELECT)
        .eq("company_id", companyId)
        .neq("status", "done")
        .order("created_at", { ascending: false }),
      supabase
        .from("qa_projects")
        .select(PROJECT_SELECT)
        .eq("company_id", companyId)
        .eq("status", "done")
        .order("updated_at", { ascending: false }),
    ]);
    activeProjects = (rawActive ?? []) as unknown as QaProjectCardData[];
    doneProjects = (rawDone ?? []) as unknown as QaProjectCardData[];
  }

  const hasNoProjects =
    activeProjects.length === 0 && doneProjects.length === 0;

  return (
    <div>
      <PageHeader
        title="المنظومات والمواقع"
        description="إجراءات اختبار للمنصات والمواقع — تأكيد النجاح أو تسجيل خلل أو تحسين."
        action={
          canManage ? (
            <Link
              href="/portal/testing/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              منصة جديدة
            </Link>
          ) : null
        }
      />

      {hasNoProjects ? (
        <EmptyState
          icon={AppWindow}
          title="لا توجد منصات"
          description={
            canManage
              ? "أنشئ منصة وأضف أقساماً وعناصر للتحقق منها."
              : "لم تُضف أي منصة بعد."
          }
          action={
            canManage ? (
              <Link
                href="/portal/testing/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-semibold text-sm"
              >
                <Plus className="w-4 h-4" />
                إنشاء منصة
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-10">
          {activeProjects.length > 0 ? (
            <section>
              <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
                منصات نشطة ({activeProjects.length})
              </h2>
              <QaProjectsGrid projects={activeProjects} canManage={canManage} />
            </section>
          ) : null}

          {doneProjects.length > 0 ? (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
                <Archive className="w-4 h-4" />
                منتهية ({doneProjects.length})
              </h2>
              <QaProjectsGrid
                projects={doneProjects}
                canManage={canManage}
                isDoneSection
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
