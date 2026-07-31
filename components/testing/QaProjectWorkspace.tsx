"use client";

import { useCallback, useState } from "react";
import {
  QaSectionsList,
  type QaListSection,
} from "@/components/testing/QaSectionsList";
import { QaTestingOverviewPanel } from "@/components/testing/QaTestingOverviewPanel";
import { cn } from "@/lib/utils";

type MobileTab = "list" | "overview";

export function QaProjectWorkspace({
  projectId,
  sections,
  canManage,
  canInteract,
}: {
  projectId: string;
  sections: QaListSection[];
  canManage: boolean;
  canInteract: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("list");

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
            onSearchChange={setSearchQuery}
            onSelectSection={selectSection}
            onSelectItem={selectItem}
          />
        </div>
      </div>
    </div>
  );
}
