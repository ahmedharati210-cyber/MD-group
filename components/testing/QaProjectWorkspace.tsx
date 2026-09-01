"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  QaSectionsList,
  type QaListSection,
} from "@/components/testing/QaSectionsList";
import { QaTestingOverviewPanel } from "@/components/testing/QaTestingOverviewPanel";
import { RestoreListFilters } from "@/components/portal/list-filters";
import {
  LIST_FILTER_KEYS,
  saveListFilters,
  type QaFilterChip,
} from "@/lib/portal-list-filters";
import { cn } from "@/lib/utils";

type MobileTab = "list" | "overview";

export function QaProjectWorkspace({
  projectId,
  sections,
  canManage,
  canInteract,
  initialFilter = "all",
  initialQuery = "",
}: {
  projectId: string;
  sections: QaListSection[];
  canManage: boolean;
  canInteract: boolean;
  initialFilter?: QaFilterChip;
  initialQuery?: string;
}) {
  const router = useRouter();
  const path = `/portal/testing/${projectId}`;
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<QaFilterChip>(initialFilter);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("list");

  useEffect(() => {
    setSearchQuery(initialQuery);
    setFilter(initialFilter);
  }, [initialFilter, initialQuery]);

  function writeUrl(nextFilter: QaFilterChip, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    const trimmed = nextQuery.trim();
    if (trimmed) params.set("q", trimmed);
    saveListFilters(path, params, LIST_FILTER_KEYS.testing);
    const qs = params.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  }

  function onFilterChange(next: QaFilterChip) {
    setFilter(next);
    writeUrl(next, searchQuery);
  }

  function onSearchChange(value: string) {
    setSearchQuery(value);
    writeUrl(filter, value);
  }

  const handleFocusHandled = useCallback(() => {
    setFocusItemId(null);
    setFocusSectionId(null);
  }, []);

  function selectSection(sectionId: string) {
    setFocusSectionId(sectionId);
    setMobileTab("list");
  }

  function selectItem(itemId: string) {
    setFocusItemId(itemId);
    setMobileTab("list");
  }

  const tabBtn = (id: MobileTab, label: string) => (
    <button
      type="button"
      onClick={() => setMobileTab(id)}
      aria-pressed={mobileTab === id}
      className={cn(
        "flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors",
        mobileTab === id
          ? "bg-teal-600 text-white"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <RestoreListFilters path={path} keys={LIST_FILTER_KEYS.testing} />
      <div
        className="flex gap-2 lg:hidden"
        role="tablist"
        aria-label="عرض الاختبارات"
      >
        {tabBtn("list", "القائمة")}
        {tabBtn("overview", "نظرة عامة")}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start">
        <div
          className={cn(
            "min-w-0",
            mobileTab !== "list" && "hidden lg:block",
          )}
        >
          <QaSectionsList
            projectId={projectId}
            sections={sections}
            canManage={canManage}
            canInteract={canInteract}
            searchQuery={searchQuery}
            filter={filter}
            onFilterChange={onFilterChange}
            focusItemId={focusItemId}
            focusSectionId={focusSectionId}
            onFocusHandled={handleFocusHandled}
          />
        </div>

        <div
          className={cn(
            "min-w-0",
            mobileTab !== "overview" && "hidden lg:block",
          )}
        >
          <QaTestingOverviewPanel
            sections={sections}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onSelectSection={selectSection}
            onSelectItem={selectItem}
          />
        </div>
      </div>
    </div>
  );
}

