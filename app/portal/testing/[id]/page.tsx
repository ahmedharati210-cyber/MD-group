import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireTestingAccess } from "@/lib/auth";
import { canManageTesting, getItqanCompanyId } from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteQaProjectButton } from "@/components/testing/DeleteQaProjectButton";
import { AddQaSectionForm } from "@/components/testing/AddQaSectionForm";
import { AddQaTestItemForm } from "@/components/testing/AddQaTestItemForm";
import { DeleteQaSectionButton } from "@/components/testing/DeleteQaSectionButton";
import { DeleteQaTestItemButton } from "@/components/testing/DeleteQaTestItemButton";
import { EditQaSectionButton } from "@/components/testing/EditQaSectionButton";
import { EditQaTestItemButton } from "@/components/testing/EditQaTestItemButton";
import { QaItemKindBadge } from "@/components/testing/QaItemKindBadge";
import { QaTestResultPanel } from "@/components/testing/QaTestResultPanel";
import { QaProjectStatusSelect } from "@/components/testing/QaProjectStatusSelect";
import type { QaItemKind, QaProjectStatus, QaTestResult } from "@/types/db";

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  item_kind: QaItemKind;
  result: QaTestResult | null;
  result_note: string | null;
  tested_by: string | null;
  tested_at: string | null;
  sort_order: number;
  tester: { full_name: string } | null;
};

type SectionRow = {
  id: string;
  name: string;
  sort_order: number;
  items: ItemRow[];
};

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: QaProjectStatus;
};

export default async function QaProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireTestingAccess();
  const canManage = canManageTesting(profile);
  const companyId = await getItqanCompanyId();
  const supabase = await createSupabaseServerClient();

  if (!companyId) notFound();

  const [{ data: rawProject }, { data: rawSections }] = await Promise.all([
    supabase
      .from("qa_projects")
      .select("id, name, description, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("qa_sections")
      .select(
        `id, name, sort_order,
          items:qa_test_items(
            id, title, description, item_kind, result, result_note,
            tested_by, tested_at, sort_order,
            tester:tested_by(full_name)
          )`,
      )
      .eq("project_id", id)
      .order("sort_order"),
  ]);

  if (!rawProject) notFound();

  const project = rawProject as unknown as ProjectRow;
  const sections = ((rawSections ?? []) as unknown as SectionRow[]).map(
    (sec) => ({
      ...sec,
      items: [...(sec.items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    }),
  );

  const allItems = sections.flatMap((s) => s.items);
  const total = allItems.length;
  const tested = allItems.filter((i) => i.result != null).length;
  const bugs = allItems.filter((i) => i.result === "bug").length;
  const improves = allItems.filter((i) => i.result === "improve").length;
  const passes = allItems.filter((i) => i.result === "pass").length;
  const pct = total > 0 ? Math.round((tested / total) * 100) : 0;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        action={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/portal/testing/${id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                تعديل
              </Link>
              <DeleteQaProjectButton projectId={id} />
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        {canManage ? (
          <QaProjectStatusSelect projectId={id} status={project.status} />
        ) : (
          <span
            className={`text-sm font-semibold px-3 py-1 rounded-full ${
              project.status === "done"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
            }`}
          >
            {project.status === "done" ? "منتهٍ" : "نشط"}
          </span>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400">
          التقدم: {tested}/{total} ({pct}%)
        </span>
        {passes > 0 ? (
          <span className="text-xs font-medium text-emerald-600">
            {passes} نجاح
          </span>
        ) : null}
        {bugs > 0 ? (
          <span className="text-xs font-medium text-red-600">{bugs} خلل</span>
        ) : null}
        {improves > 0 ? (
          <span className="text-xs font-medium text-amber-600">
            {improves} تحسين
          </span>
        ) : null}
      </div>

      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const sTested = section.items.filter((i) => i.result != null).length;
          return (
            <section
              key={section.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-50">
                    {section.name}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {sTested}/{section.items.length} مختبر
                  </p>
                </div>
                {canManage ? (
                  <div className="flex items-center gap-0.5">
                    <EditQaSectionButton
                      sectionId={section.id}
                      projectId={id}
                      name={section.name}
                    />
                    <DeleteQaSectionButton
                      sectionId={section.id}
                      projectId={id}
                    />
                  </div>
                ) : null}
              </div>

              <ul className="space-y-4">
                {section.items.map((item) => {
                  const kind = item.item_kind ?? "test";
                  return (
                    <li
                      key={item.id}
                      className="border border-gray-100 dark:border-gray-800 rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <QaItemKindBadge
                              itemId={item.id}
                              projectId={id}
                              itemKind={kind}
                              canManage={canManage}
                            />
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {item.title}
                          </h3>
                          {item.description ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        {canManage ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <EditQaTestItemButton
                              itemId={item.id}
                              projectId={id}
                              title={item.title}
                              description={item.description}
                              itemKind={kind}
                            />
                            <DeleteQaTestItemButton
                              itemId={item.id}
                              projectId={id}
                            />
                          </div>
                        ) : null}
                      </div>

                      <QaTestResultPanel
                        itemId={item.id}
                        projectId={id}
                        itemKind={kind}
                        result={item.result}
                        resultNote={item.result_note}
                        testedAt={item.tested_at}
                        testerName={item.tester?.full_name ?? null}
                        canManage={canManage}
                      />
                    </li>
                  );
                })}
              </ul>

              {canManage ? (
                <AddQaTestItemForm sectionId={section.id} projectId={id} />
              ) : null}
            </section>
          );
        })}
      </div>

      {canManage ? (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <AddQaSectionForm projectId={id} />
        </div>
      ) : null}
    </div>
  );
}
