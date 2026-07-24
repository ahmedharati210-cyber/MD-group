"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import type { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type SortableListeners = ReturnType<typeof useSortable>["listeners"];

export function QaSortableHandle({
  attributes,
  listeners,
  className,
}: {
  attributes: DraggableAttributes;
  listeners: SortableListeners;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none shrink-0",
        className,
      )}
      aria-label="سحب لإعادة الترتيب"
      title="سحب لإعادة الترتيب"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}
