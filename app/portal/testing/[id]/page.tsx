import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireTestingAccess } from "@/lib/auth";
import {
  canInteractWithTesting,
  canManageTesting,
  getItqanCompanyId,
} from "@/lib/itqan-testing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteQaProjectButton } from "@/components/testing/DeleteQaProjectButton";
import { QaProjectStatusSelect } from "@/components/testing/QaProjectStatusSelect";
import {
  QaSectionsList,
  type QaListSection,
} from "@/components/testing/QaSectionsList";
import type { QaItemKind, QaProjectStatus } from "@/types/db";

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
  const canInteract = canInteractWithTesting(profile);
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
            severity, steps_to_reproduce, expected_behavior,
            tested_by, tested_at, sort_order,
            tester:tested_by(full_name),
            attempts:qa_test_attempts(
              id, result, result_note, severity, steps_to_reproduce,
              expected_behavior, tested_at, reset_at,
              tester:tested_by(full_name),
              resetter:reset_by(full_name)
            )
          )`,
      )
      .eq("project_id", id)
      .order("sort_order"),
  ]);

  if (!rawProject) notFound();

  const project = rawProject as unknown as ProjectRow;
  const sections = ((rawSections ?? []) as unknown as QaListSection[]).map(
    (sec) => ({
      ...sec,
      items: [...(sec.items ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          ...item,
          severity: item.severity ?? null,
          steps_to_reproduce: item.steps_to_reproduce ?? null,
          expected_behavior: item.expected_behavior ?? null,
          attempts: [...(item.attempts ?? [])].sort((a, b) =>
            b.reset_at.localeCompare(a.reset_at),
          ),
        })),
    }),
  );

  const allItems = sections.flatMap((s) => s.items);
  const testItems = allItems.filter(
    (i) => (i.item_kind as QaItemKind | undefined) !== "task",
  );
  const taskCount = allItems.length - testItems.length;
  const total = testItems.length;
  const tested = testItems.filter((i) => i.result != null).length;
  const bugs = testItems.filter((i) => i.result === "bug").length;
  const improves = testItems.filter((i) => i.result === "improve").length;
  const passes = testItems.filter((i) => i.result === "pass").length;
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
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                تعديل
              </Link>
              <DeleteQaProjectButton projectId={id} />
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {canManage ? (
          <QaProjectStatusSelect projectId={id} status={project.status} />
        ) : (
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              project.status === "done"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
            }`}
          >
            {project.status === "done" ? "منتهٍ" : "نشط"}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {tested}/{total} ({pct}%)
        </span>
        {taskCount > 0 ? (
          <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            {taskCount} مهام
          </span>
        ) : null}
        {passes > 0 ? (
          <span className="text-[11px] font-medium text-emerald-600">
            {passes} نجاح
          </span>
        ) : null}
        {bugs > 0 ? (
          <span className="text-[11px] font-medium text-red-600">{bugs} خلل</span>
        ) : null}
        {improves > 0 ? (
          <span className="text-[11px] font-medium text-amber-600">
            {improves} تحسين
          </span>
        ) : null}
      </div>

      <div
        className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`تقدم الاختبار ${pct}%`}
      >
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <QaSectionsList
        projectId={id}
        sections={sections}
        canManage={canManage}
        canInteract={canInteract}
      />
    </div>
  );
}
