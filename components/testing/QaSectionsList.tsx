"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { AddQaSectionForm } from "@/components/testing/AddQaSectionForm";
import { AddQaTestItemForm } from "@/components/testing/AddQaTestItemForm";
import { DeleteQaSectionButton } from "@/components/testing/DeleteQaSectionButton";
import { DeleteQaTestItemButton } from "@/components/testing/DeleteQaTestItemButton";
import { EditQaSectionButton } from "@/components/testing/EditQaSectionButton";
import { EditQaTestItemButton } from "@/components/testing/EditQaTestItemButton";
import { QaItemKindBadge } from "@/components/testing/QaItemKindBadge";
import { QaTestResultPanel } from "@/components/testing/QaTestResultPanel";
import type { QaItemKind, QaTestResult } from "@/types/db";
import { cn } from "@/lib/utils";

export type QaListItem = {
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

export type QaListSection = {
  id: string;
  name: string;
  sort_order: number;
  items: QaListItem[];
};

type Filter = "all" | "pending" | "tasks";

export function QaSectionsList({
  projectId,
  sections,
  canManage,
}: {
  projectId: string;
  sections: QaListSection[];
  canManage: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [hideDone, setHideDone] = useState(false);
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  const filteredSections = useMemo(() => {
    return sections
      .map((sec) => {
        let items = sec.items;
        if (filter === "pending") {
          items = items.filter((i) => i.result == null);
        } else if (filter === "tasks") {
          items = items.filter((i) => (i.item_kind ?? "test") === "task");
        }
        if (hideDone) {
          items = items.filter((i) => i.result == null);
        }
        return { ...sec, items, sourceEmpty: sec.items.length === 0 };
      })
      .filter(
        (sec) =>
          sec.items.length > 0 ||
          // Keep brand-new empty sections visible so managers can add items
          (filter === "all" && !hideDone && sec.sourceEmpty),
      );
  }, [sections, filter, hideDone]);

  function toggleSection(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const chip = (id: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(id)}
      className={cn(
        "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
        filter === id
          ? "bg-teal-600 text-white"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "الكل")}
        {chip("pending", "غير مختبر")}
        {chip("tasks", "مهام")}
        <button
          type="button"
          onClick={() => setHideDone((v) => !v)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors",
            hideDone
              ? "bg-amber-600 text-white"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
          )}
        >
          إخفاء المكتمل
        </button>
      </div>

      <div className="space-y-2">
        {filteredSections.map((section) => {
          const original = sections.find((s) => s.id === section.id);
          const sTested =
            original?.items.filter((i) => i.result != null).length ?? 0;
          const sTotal = original?.items.length ?? section.items.length;
          const isCollapsed = collapsed[section.id] === true;

          return (
            <section
              key={section.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-1 px-2.5 py-2 border-b border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex flex-1 items-center gap-2 min-w-0 text-right hover:opacity-80"
                >
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-gray-400 shrink-0 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-50 truncate">
                    {section.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-gray-400 shrink-0">
                    {sTested}/{sTotal}
                  </span>
                </button>
                {canManage ? (
                  <div className="flex items-center shrink-0">
                    <EditQaSectionButton
                      sectionId={section.id}
                      projectId={projectId}
                      name={section.name}
                    />
                    <DeleteQaSectionButton
                      sectionId={section.id}
                      projectId={projectId}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCollapsed((prev) => ({
                          ...prev,
                          [section.id]: false,
                        }));
                        setAddingItemFor((cur) =>
                          cur === section.id ? null : section.id,
                        );
                      }}
                      className="p-1.5 text-gray-400 hover:text-teal-600"
                      title="إضافة عنصر"
                      aria-label="إضافة عنصر"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              {!isCollapsed ? (
                <>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {section.items.map((item) => {
                      const kind = item.item_kind ?? "test";
                      const done = item.result != null;
                      return (
                        <li
                          key={item.id}
                          className={cn(
                            "px-2 py-1.5",
                            done && "opacity-70",
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-h-7">
                            <QaItemKindBadge
                              itemId={item.id}
                              projectId={projectId}
                              itemKind={kind}
                              canManage={canManage}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-sm leading-snug truncate",
                                  done
                                    ? "text-gray-500 dark:text-gray-400"
                                    : "text-gray-900 dark:text-gray-100 font-medium",
                                )}
                                title={item.title}
                              >
                                {item.title}
                              </p>
                              {item.description ? (
                                <p className="text-[11px] text-gray-400 truncate">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                            {canManage ? (
                              <div className="flex items-center shrink-0">
                                <EditQaTestItemButton
                                  itemId={item.id}
                                  projectId={projectId}
                                  title={item.title}
                                  description={item.description}
                                  itemKind={kind}
                                />
                                <DeleteQaTestItemButton
                                  itemId={item.id}
                                  projectId={projectId}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-0.5 pr-0.5 flex justify-start sm:justify-end">
                            <QaTestResultPanel
                              itemId={item.id}
                              projectId={projectId}
                              itemKind={kind}
                              result={item.result}
                              resultNote={item.result_note}
                              testedAt={item.tested_at}
                              testerName={item.tester?.full_name ?? null}
                              canManage={canManage}
                              compact
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {canManage && addingItemFor === section.id ? (
                    <div className="px-2.5 pb-2.5">
                      <AddQaTestItemForm
                        sectionId={section.id}
                        projectId={projectId}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          );
        })}
      </div>

      {canManage ? (
        <div className="pt-2">
          {showAddSection ? (
            <div className="space-y-2">
              <AddQaSectionForm projectId={projectId} />
              <button
                type="button"
                onClick={() => setShowAddSection(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                إخفاء
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddSection(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700"
            >
              <Plus className="w-4 h-4" />
              إضافة قسم
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
