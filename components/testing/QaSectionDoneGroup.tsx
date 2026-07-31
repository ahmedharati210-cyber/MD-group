"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { QaListItem } from "@/components/testing/QaSectionsList";
import { cn } from "@/lib/utils";

export function QaSectionDoneGroup({
  sectionId,
  items,
  isOpen,
  onToggle,
  forceOpen,
  focusItemId,
  renderItem,
}: {
  sectionId: string;
  items: QaListItem[];
  isOpen: boolean;
  onToggle: () => void;
  /** When searching / focusing a done item, keep the group expanded. */
  forceOpen?: boolean;
  focusItemId?: string | null;
  renderItem: (item: QaListItem) => ReactNode;
}) {
  if (items.length === 0) return null;

  const open = forceOpen || isOpen;
  const focusedInside = focusItemId
    ? items.some((i) => i.id === focusItemId)
    : false;
  const expanded = open || focusedInside;

  return (
    <div
      className="border-t border-gray-100 dark:border-gray-800"
      data-qa-done-group={sectionId}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
      >
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform",
            !expanded && "-rotate-90",
          )}
        />
        <span>مكتمل ({items.length})</span>
      </button>
      {expanded ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
          {items.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
