"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  reorderQaSectionsAction,
  reorderQaTestItemsAction,
} from "@/app/portal/testing/actions";
import { AddQaSectionForm } from "@/components/testing/AddQaSectionForm";
import { AddQaTestItemForm } from "@/components/testing/AddQaTestItemForm";
import { DeleteQaSectionButton } from "@/components/testing/DeleteQaSectionButton";
import { DeleteQaTestItemButton } from "@/components/testing/DeleteQaTestItemButton";
import { EditQaSectionButton } from "@/components/testing/EditQaSectionButton";
import {
  EditQaTestItemButton,
  EditQaTestItemForm,
} from "@/components/testing/EditQaTestItemButton";
import { QaItemKindBadge } from "@/components/testing/QaItemKindBadge";
import { QaSectionDoneGroup } from "@/components/testing/QaSectionDoneGroup";
import { QaSortableHandle } from "@/components/testing/QaSortableHandle";
import type { QaAttemptHistoryEntry } from "@/components/testing/QaTestAttemptHistory";
import type { QaScreenshotMeta } from "@/components/testing/QaScreenshotGallery";
import { QaScreenshotGallery } from "@/components/testing/QaScreenshotGallery";
import { QaTestResultPanel } from "@/components/testing/QaTestResultPanel";
import {
  computeQaProgress,
  isQaItemDone,
  matchesQaSearch,
  partitionQaItems,
} from "@/lib/qa-testing-format";
import type { QaItemKind, QaTestResult, QaTestSeverity } from "@/types/db";
import { cn } from "@/lib/utils";
import type { QaFilterChip } from "@/lib/portal-list-filters";

export type QaListItem = {
  id: string;
  title: string;
  description: string | null;
  item_kind: QaItemKind;
  result: QaTestResult | null;
  result_note: string | null;
  severity: QaTestSeverity | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  tested_by: string | null;
  tested_at: string | null;
  sort_order: number;
  tester: { full_name: string } | null;
  attempts?: QaAttemptHistoryEntry[];
  attachments?: QaScreenshotMeta[];
};

export type QaListSection = {
  id: string;
  name: string;
  sort_order: number;
  items: QaListItem[];
};

type Filter = QaFilterChip;

function sortByOrder<T extends { sort_order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}

function defaultCollapsedMap(
  secs: QaListSection[],
): Record<string, boolean> {
  const ordered = sortByOrder(secs);
  const init: Record<string, boolean> = {};
  ordered.forEach((s, index) => {
    if (index < 2) return; // first two always open
    if ((s.items?.length ?? 0) > 12) init[s.id] = true;
  });
  return init;
}

export function QaSectionsList({
  projectId,
  sections: initialSections,
  canManage,
  canInteract,
  searchQuery = "",
  filter = "all",
  onFilterChange,
  focusItemId = null,
  focusSectionId = null,
  onFocusHandled,
}: {
  projectId: string;
  sections: QaListSection[];
  canManage: boolean;
  canInteract: boolean;
  searchQuery?: string;
  filter?: Filter;
  onFilterChange?: (filter: Filter) => void;
  focusItemId?: string | null;
  focusSectionId?: string | null;
  onFocusHandled?: () => void;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(() =>
    sortByOrder(initialSections).map((s) => ({
      ...s,
      items: sortByOrder(s.items ?? []),
    })),
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    defaultCollapsedMap(initialSections),
  );
  const [doneOpen, setDoneOpen] = useState<Record<string, boolean>>({});
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  // dnd-kit assigns incremental aria-describedby ids; SSR vs client counters
  // diverge and cause hydration mismatches. Enable DnD only after mount.
  const [dndReady, setDndReady] = useState(false);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    setDndReady(true);
  }, []);

  useEffect(() => {
    setSections(
      sortByOrder(initialSections).map((s) => ({
        ...s,
        items: sortByOrder(s.items ?? []),
      })),
    );
  }, [initialSections]);

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;

  // Expand sections / done groups and scroll when focus requests arrive.
  useEffect(() => {
    if (!focusItemId && !focusSectionId) return;

    // Ensure the target is in the DOM (not hidden by خلل وتحسين/مهام filters).
    onFilterChange?.("all");

    let targetSectionId = focusSectionId;
    let targetIsDone = false;

    if (focusItemId) {
      for (const sec of sectionsRef.current) {
        const item = sec.items.find((i) => i.id === focusItemId);
        if (item) {
          targetSectionId = sec.id;
          targetIsDone = isQaItemDone(item);
          break;
        }
      }
    }

    if (targetSectionId) {
      setCollapsed((prev) => ({ ...prev, [targetSectionId!]: false }));
      if (targetIsDone) {
        setDoneOpen((prev) => ({
          ...prev,
          [targetSectionId!]: true,
        }));
      }
    }

    const idToScroll = focusItemId
      ? `qa-item-${focusItemId}`
      : targetSectionId
        ? `qa-section-${targetSectionId}`
        : null;
    const itemToHighlight = focusItemId;

    // Let expand state commit, then scroll / highlight.
    requestAnimationFrame(() => {
      if (idToScroll) {
        document
          .getElementById(idToScroll)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (itemToHighlight) setHighlightItemId(itemToHighlight);
      onFocusHandled?.();
    });
  }, [focusItemId, focusSectionId, onFocusHandled]);

  useEffect(() => {
    if (!highlightItemId) return;
    const timer = setTimeout(() => setHighlightItemId(null), 2200);
    return () => clearTimeout(timer);
  }, [highlightItemId]);

  const canReorder = dndReady && canManage && filter === "all" && !isSearching;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filteredSections = useMemo(() => {
    return sections
      .map((sec) => {
        let items = sec.items;
        if (filter === "pending") {
          items = items.filter(
            (i) => (i.item_kind ?? "test") !== "task" && i.result == null,
          );
        } else if (filter === "open") {
          items = items.filter(
            (i) => i.result === "bug" || i.result === "improve",
          );
        } else if (filter === "tasks") {
          items = items.filter((i) => (i.item_kind ?? "test") === "task");
        }
        if (isSearching) {
          items = items.filter((i) => matchesQaSearch(i, trimmedQuery));
        }
        return { ...sec, items, sourceEmpty: sec.items.length === 0 };
      })
      .filter(
        (sec) =>
          sec.items.length > 0 ||
          (filter === "all" && !isSearching && sec.sourceEmpty),
      );
  }, [sections, filter, isSearching, trimmedQuery]);

  async function onSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(sections, oldIndex, newIndex).map((s, index) => ({
      ...s,
      sort_order: index,
    }));
    setSections(next);

    const res = await reorderQaSectionsAction(
      projectId,
      next.map((s) => s.id),
    );
    if (res.error) {
      toast.error(res.error);
      router.refresh();
    }
  }

  async function onItemDragEnd(sectionId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;

    const { pending, done } = partitionQaItems(section.items);
    const oldIndex = pending.findIndex((i) => i.id === active.id);
    const newIndex = pending.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextPending = arrayMove(pending, oldIndex, newIndex);
    // Keep done items after pending in stable relative order for sort_order.
    const nextItems = [
      ...nextPending.map((item, index) => ({ ...item, sort_order: index })),
      ...done.map((item, index) => ({
        ...item,
        sort_order: nextPending.length + index,
      })),
    ];
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, items: nextItems } : s)),
    );

    const res = await reorderQaTestItemsAction(
      sectionId,
      projectId,
      nextItems.map((i) => i.id),
    );
    if (res.error) {
      toast.error(res.error);
      router.refresh();
    }
  }

  const chip = (id: Filter, label: string) => (
    <button
      type="button"
      onClick={() => onFilterChange?.(id)}
      aria-pressed={filter === id}
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

  const showDoneGroup = filter === "all";

  const sectionsContent =
    filteredSections.length === 0 ? (
      <p className="text-sm text-gray-500 dark:text-gray-400 px-1 py-6 text-center">
        لا عناصر مطابقة
      </p>
    ) : (
      <div className="space-y-2">
        {filteredSections.map((section) => {
          const original = sections.find((s) => s.id === section.id);
          const originalItems = original?.items ?? [];
          const sStats = computeQaProgress(originalItems);

          const { pending, done } = partitionQaItems(section.items);
          // When filter is pending/tasks, section.items is already filtered —
          // partition still works: pending filter → all pending, tasks → all pending.
          const pendingItems = showDoneGroup ? pending : section.items;
          const doneItems = showDoneGroup ? done : [];

          const forceDoneOpen =
            isSearching ||
            (focusItemId != null &&
              doneItems.some((i) => i.id === focusItemId));

          return (
            <SectionCard
              key={section.id}
              section={{ ...section, items: pendingItems }}
              doneItems={doneItems}
              projectId={projectId}
              canManage={canManage}
              canInteract={canInteract}
              canReorder={canReorder}
              isCollapsed={
                isSearching ? false : collapsed[section.id] === true
              }
              sTested={sStats.tested}
              sTotal={sStats.total}
              sOpen={sStats.open}
              addingItemFor={addingItemFor}
              editingItemId={editingItemId}
              highlightItemId={highlightItemId}
              doneOpen={doneOpen[section.id] === true}
              forceDoneOpen={forceDoneOpen}
              sensors={sensors}
              onToggle={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [section.id]: !prev[section.id],
                }))
              }
              onToggleDone={() =>
                setDoneOpen((prev) => ({
                  ...prev,
                  [section.id]: !prev[section.id],
                }))
              }
              onAddItemToggle={() => {
                setCollapsed((prev) => ({
                  ...prev,
                  [section.id]: false,
                }));
                setAddingItemFor((cur) =>
                  cur === section.id ? null : section.id,
                );
              }}
              onCancelAddItem={() => setAddingItemFor(null)}
              onEditingChange={setEditingItemId}
              onItemDragEnd={(event) => onItemDragEnd(section.id, event)}
            />
          );
        })}
      </div>
    );

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="تصفية العناصر"
      >
        {chip("all", "الكل")}
        {chip("pending", "غير مختبر")}
        {chip("open", "خلل وتحسين")}
        {chip("tasks", "مهام")}
      </div>

      {canManage && dndReady && !canReorder ? (
        <p className="text-[11px] text-gray-400">
          أعد الترتيب من تبويب «الكل» بدون بحث
        </p>
      ) : null}

      {canReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onSectionDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {sectionsContent}
          </SortableContext>
        </DndContext>
      ) : (
        sectionsContent
      )}

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

type SectionCardProps = {
  section: QaListSection;
  doneItems: QaListItem[];
  projectId: string;
  canManage: boolean;
  canInteract: boolean;
  canReorder: boolean;
  isCollapsed: boolean;
  sTested: number;
  sTotal: number;
  sOpen: number;
  addingItemFor: string | null;
  editingItemId: string | null;
  highlightItemId: string | null;
  doneOpen: boolean;
  forceDoneOpen: boolean;
  sensors: ReturnType<typeof useSensors>;
  onToggle: () => void;
  onToggleDone: () => void;
  onAddItemToggle: () => void;
  onCancelAddItem: () => void;
  onEditingChange: (id: string | null) => void;
  onItemDragEnd: (event: DragEndEvent) => void;
};

function SectionCard(props: SectionCardProps) {
  if (props.canReorder) {
    return <SortableSectionCard {...props} />;
  }
  return <StaticSectionCard {...props} />;
}

function SectionChrome({
  section,
  projectId,
  canManage,
  isCollapsed,
  isAdding,
  sTested,
  sTotal,
  sOpen,
  onToggle,
  onAddItemToggle,
  handle,
  children,
  setNodeRef,
  style,
}: {
  section: QaListSection;
  projectId: string;
  canManage: boolean;
  isCollapsed: boolean;
  isAdding: boolean;
  sTested: number;
  sTotal: number;
  sOpen: number;
  onToggle: () => void;
  onAddItemToggle: () => void;
  handle?: React.ReactNode;
  children: React.ReactNode;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
}) {
  return (
    <section
      id={`qa-section-${section.id}`}
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden scroll-mt-20"
    >
      <div className="flex items-center gap-1 px-2.5 py-2 border-b border-gray-100 dark:border-gray-800">
        {handle}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
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
            {sOpen > 0 ? ` · ${sOpen} خلل/تحسين` : ""}
          </span>
        </button>
        {canManage ? (
          <div className="flex items-center shrink-0 min-w-0">
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
              onClick={onAddItemToggle}
              className={cn(
                "p-1.5 transition-colors",
                isAdding
                  ? "text-red-500 hover:text-red-600"
                  : "text-gray-400 hover:text-teal-600",
              )}
              title={isAdding ? "إلغاء الإضافة" : "إضافة عنصر"}
              aria-label={isAdding ? "إلغاء الإضافة" : "إضافة عنصر"}
            >
              {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function renderDoneItem(
  item: QaListItem,
  {
    projectId,
    canManage,
    canInteract,
    editingItemId,
    highlightItemId,
    onEditingChange,
  }: {
    projectId: string;
    canManage: boolean;
    canInteract: boolean;
    editingItemId: string | null;
    highlightItemId: string | null;
    onEditingChange: (id: string | null) => void;
  },
) {
  const kind = item.item_kind ?? "test";
  return (
    <div
      id={`qa-item-${item.id}`}
      className={cn(
        "px-2 py-1.5 scroll-mt-24 transition-colors",
        highlightItemId === item.id &&
          "bg-teal-50 dark:bg-teal-900/30 ring-1 ring-inset ring-teal-300 dark:ring-teal-700",
      )}
    >
      <ItemContent
        item={item}
        kind={kind}
        projectId={projectId}
        canManage={canManage}
        canInteract={canInteract}
        isEditing={editingItemId === item.id}
        onEditingChange={onEditingChange}
      />
    </div>
  );
}

function StaticSectionCard({
  section,
  doneItems,
  projectId,
  canManage,
  canInteract,
  isCollapsed,
  sTested,
  sTotal,
  sOpen,
  addingItemFor,
  editingItemId,
  highlightItemId,
  doneOpen,
  forceDoneOpen,
  onToggle,
  onToggleDone,
  onAddItemToggle,
  onCancelAddItem,
  onEditingChange,
}: SectionCardProps) {
  const isAdding = addingItemFor === section.id;

  return (
    <SectionChrome
      section={section}
      projectId={projectId}
      canManage={canManage}
      isCollapsed={isCollapsed}
      isAdding={isAdding}
      sTested={sTested}
      sTotal={sTotal}
      sOpen={sOpen}
      onToggle={onToggle}
      onAddItemToggle={onAddItemToggle}
    >
      {!isCollapsed ? (
        <>
          {canManage && isAdding ? (
            <div
              id={`qa-add-${section.id}`}
              className="px-2.5 pt-2 pb-1 scroll-mt-24"
            >
              <AddQaTestItemForm
                sectionId={section.id}
                projectId={projectId}
                onCancel={onCancelAddItem}
              />
            </div>
          ) : null}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {section.items.map((item) => {
              const kind = item.item_kind ?? "test";
              return (
                <li
                  key={item.id}
                  id={`qa-item-${item.id}`}
                  className={cn(
                    "px-2 py-1.5 scroll-mt-24 transition-colors",
                    highlightItemId === item.id &&
                      "bg-teal-50 dark:bg-teal-900/30 ring-1 ring-inset ring-teal-300 dark:ring-teal-700",
                  )}
                >
                  <ItemContent
                    item={item}
                    kind={kind}
                    projectId={projectId}
                    canManage={canManage}
                    canInteract={canInteract}
                    isEditing={editingItemId === item.id}
                    onEditingChange={onEditingChange}
                  />
                </li>
              );
            })}
          </ul>
          <QaSectionDoneGroup
            sectionId={section.id}
            items={doneItems}
            isOpen={doneOpen}
            onToggle={onToggleDone}
            forceOpen={forceDoneOpen}
            focusItemId={highlightItemId}
            renderItem={(item) =>
              renderDoneItem(item, {
                projectId,
                canManage,
                canInteract,
                editingItemId,
                highlightItemId,
                onEditingChange,
              })
            }
          />
        </>
      ) : null}
    </SectionChrome>
  );
}

function SortableSectionCard({
  section,
  doneItems,
  projectId,
  canManage,
  canInteract,
  isCollapsed,
  sTested,
  sTotal,
  sOpen,
  addingItemFor,
  editingItemId,
  highlightItemId,
  doneOpen,
  forceDoneOpen,
  sensors,
  onToggle,
  onToggleDone,
  onAddItemToggle,
  onCancelAddItem,
  onEditingChange,
  onItemDragEnd,
}: SectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  const isAdding = addingItemFor === section.id;

  return (
    <SectionChrome
      section={section}
      projectId={projectId}
      canManage={canManage}
      isCollapsed={isCollapsed}
      isAdding={isAdding}
      sTested={sTested}
      sTotal={sTotal}
      sOpen={sOpen}
      onToggle={onToggle}
      onAddItemToggle={onAddItemToggle}
      setNodeRef={setNodeRef}
      style={style}
      handle={
        <QaSortableHandle attributes={attributes} listeners={listeners} />
      }
    >
      {!isCollapsed ? (
        <>
          {canManage && isAdding ? (
            <div
              id={`qa-add-${section.id}`}
              className="px-2.5 pt-2 pb-1 scroll-mt-24"
            >
              <AddQaTestItemForm
                sectionId={section.id}
                projectId={projectId}
                onCancel={onCancelAddItem}
              />
            </div>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onItemDragEnd}
          >
            <SortableContext
              items={section.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {section.items.map((item) => {
                  const kind = item.item_kind ?? "test";
                  return (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      kind={kind}
                      projectId={projectId}
                      canManage={canManage}
                      canInteract={canInteract}
                      isEditing={editingItemId === item.id}
                      highlighted={highlightItemId === item.id}
                      onEditingChange={onEditingChange}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>

          <QaSectionDoneGroup
            sectionId={section.id}
            items={doneItems}
            isOpen={doneOpen}
            onToggle={onToggleDone}
            forceOpen={forceDoneOpen}
            focusItemId={highlightItemId}
            renderItem={(item) =>
              renderDoneItem(item, {
                projectId,
                canManage,
                canInteract,
                editingItemId,
                highlightItemId,
                onEditingChange,
              })
            }
          />
        </>
      ) : null}
    </SectionChrome>
  );
}

function ItemContent({
  item,
  kind,
  projectId,
  canManage,
  canInteract,
  isEditing,
  onEditingChange,
  handle,
}: {
  item: QaListItem;
  kind: QaItemKind;
  projectId: string;
  canManage: boolean;
  canInteract: boolean;
  isEditing: boolean;
  onEditingChange: (id: string | null) => void;
  handle?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 min-h-7">
        {handle}
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
              isQaItemDone(item)
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
              open={isEditing}
              onOpenChange={(open) =>
                onEditingChange(open ? item.id : null)
              }
            />
            <DeleteQaTestItemButton itemId={item.id} projectId={projectId} />
          </div>
        ) : null}
      </div>
      {isEditing ? (
        <EditQaTestItemForm
          itemId={item.id}
          projectId={projectId}
          title={item.title}
          description={item.description}
          itemKind={kind}
          itemAttachments={(item.attachments ?? []).filter(
            (a) => a.scope === "item",
          )}
          onClose={() => onEditingChange(null)}
        />
      ) : null}
      {!isEditing &&
      kind === "task" &&
      (item.attachments ?? []).some((a) => a.scope === "item") ? (
        <div className="mt-1">
          <QaScreenshotGallery
            itemId={item.id}
            projectId={projectId}
            scope="item"
            attachments={(item.attachments ?? []).filter(
              (a) => a.scope === "item",
            )}
            canEdit={false}
            compact
          />
        </div>
      ) : null}
      <div className="mt-0.5 pr-0.5 flex justify-start sm:justify-end">
        <QaTestResultPanel
          itemId={item.id}
          projectId={projectId}
          itemKind={kind}
          result={item.result}
          resultNote={item.result_note}
          severity={item.severity}
          stepsToReproduce={item.steps_to_reproduce}
          expectedBehavior={item.expected_behavior}
          testedAt={item.tested_at}
          testerName={item.tester?.full_name ?? null}
          resultAttachments={(item.attachments ?? []).filter(
            (a) => a.scope === "result",
          )}
          canManage={canManage}
          canInteract={canInteract}
          compact
        />
      </div>
    </>
  );
}

function SortableItemRow({
  item,
  kind,
  projectId,
  canManage,
  canInteract,
  isEditing,
  highlighted,
  onEditingChange,
}: {
  item: QaListItem;
  kind: QaItemKind;
  projectId: string;
  canManage: boolean;
  canInteract: boolean;
  isEditing: boolean;
  highlighted: boolean;
  onEditingChange: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      id={`qa-item-${item.id}`}
      ref={setNodeRef}
      style={style}
      className={cn(
        "px-2 py-1.5 bg-white dark:bg-gray-900 scroll-mt-24 transition-colors",
        highlighted &&
          "bg-teal-50 dark:bg-teal-900/30 ring-1 ring-inset ring-teal-300 dark:ring-teal-700",
      )}
    >
      <ItemContent
        item={item}
        kind={kind}
        projectId={projectId}
        canManage={canManage}
        canInteract={canInteract}
        isEditing={isEditing}
        onEditingChange={onEditingChange}
        handle={
          <QaSortableHandle attributes={attributes} listeners={listeners} />
        }
      />
    </li>
  );
}
