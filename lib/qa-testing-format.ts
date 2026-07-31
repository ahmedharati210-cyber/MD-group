import type { QaTestResult, QaTestSeverity } from "@/types/db";

/** Arabic labels + Tailwind classes for QA severity chips. */
export const QA_SEVERITY_META: Record<
  QaTestSeverity,
  { label: string; cls: string }
> = {
  low: {
    label: "منخفض",
    cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  },
  medium: {
    label: "متوسط",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  high: {
    label: "عالٍ",
    cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  critical: {
    label: "حرج",
    cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

export const QA_RESULT_LABELS: Record<QaTestResult, string> = {
  pass: "تم بنجاح",
  bug: "خلل",
  improve: "يحتاج تحسين",
};

export type QaResultSubmitInput = {
  result: QaTestResult;
  resultNote: string;
  severity?: QaTestSeverity | null;
  stepsToReproduce?: string | null;
  expectedBehavior?: string | null;
};

/**
 * Validates structured bug/improve fields before persisting a QA result.
 * Returns an Arabic error message, or null when valid.
 */
export function validateQaResultSubmit(
  input: QaResultSubmitInput,
): string | null {
  const note = input.resultNote.trim();
  const steps = (input.stepsToReproduce ?? "").trim();

  if (
    (input.result === "bug" || input.result === "improve") &&
    note.length < 1
  ) {
    return "الملاحظة مطلوبة عند تسجيل خلل أو تحسين";
  }

  if (input.result === "bug") {
    if (!input.severity) {
      return "درجة الخطورة مطلوبة عند تسجيل خلل";
    }
    if (steps.length < 1) {
      return "خطوات إعادة الإنتاج مطلوبة عند تسجيل خلل";
    }
  }

  return null;
}

/** Minimal item shape for pending/done partitioning and search. */
export type QaPartitionableItem = {
  item_kind?: "test" | "task" | null;
  result: QaTestResult | null;
  tested_at?: string | null;
  title?: string | null;
  description?: string | null;
};

/** Only a successful pass is "done"; bug/improve stay actionable. */
export function isQaItemDone(
  item: Pick<QaPartitionableItem, "item_kind" | "result">,
): boolean {
  return (item.item_kind ?? "test") !== "task" && item.result === "pass";
}

/** Items that need attention stay in the main list (bug / improve). */
export function isQaItemNeedsAttention(
  item: Pick<QaPartitionableItem, "item_kind" | "result">,
): boolean {
  return (
    (item.item_kind ?? "test") !== "task" &&
    (item.result === "bug" || item.result === "improve")
  );
}

function attentionSortRank(result: QaTestResult | null | undefined): number {
  if (result === "bug") return 0;
  if (result === "improve") return 1;
  return 2;
}

/**
 * Split items into pending (tasks, untested, bug, improve) and done (pass only).
 * Pending is sorted: bugs first, then improve, then the rest (stable by input order).
 * Done is sorted by tested_at descending (most recent first).
 */
export function partitionQaItems<T extends QaPartitionableItem>(items: T[]): {
  pending: T[];
  done: T[];
} {
  const pending: T[] = [];
  const done: T[] = [];

  for (const item of items) {
    if (isQaItemDone(item)) {
      done.push(item);
    } else {
      pending.push(item);
    }
  }

  pending.sort((a, b) => {
    const rankDiff =
      attentionSortRank(a.result) - attentionSortRank(b.result);
    if (rankDiff !== 0) return rankDiff;
    return 0;
  });

  done.sort((a, b) => {
    const aAt = a.tested_at ?? "";
    const bAt = b.tested_at ?? "";
    return bAt.localeCompare(aAt);
  });

  return { pending, done };
}

/** Case-insensitive substring match against title/description. */
export function matchesQaSearch(
  item: Pick<QaPartitionableItem, "title" | "description">,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = (item.title ?? "").toLowerCase();
  const description = (item.description ?? "").toLowerCase();
  return title.includes(q) || description.includes(q);
}

/** Project-wide recently completed feed (pass only), newest first. */
export function recentCompletedQaItems<
  T extends QaPartitionableItem & { id: string },
>(
  items: T[],
  limit = 20,
): T[] {
  return items
    .filter((i) => isQaItemDone(i))
    .sort((a, b) => (b.tested_at ?? "").localeCompare(a.tested_at ?? ""))
    .slice(0, limit);
}

const SEVERITY_RANK: Record<QaTestSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type QaOpenableItem = QaPartitionableItem & {
  id: string;
  severity?: QaTestSeverity | null;
};

/** Open bug/improve feed: severity critical→low, then tested_at desc. */
export function recentOpenQaItems<T extends QaOpenableItem>(
  items: T[],
  limit = 20,
): T[] {
  return items
    .filter((i) => isQaItemNeedsAttention(i))
    .sort((a, b) => {
      const aRank =
        a.result === "bug"
          ? (a.severity ? SEVERITY_RANK[a.severity] : 4)
          : 5;
      const bRank =
        b.result === "bug"
          ? (b.severity ? SEVERITY_RANK[b.severity] : 4)
          : 5;
      // bugs before improve; within bugs by severity
      if (a.result !== b.result) {
        if (a.result === "bug") return -1;
        if (b.result === "bug") return 1;
      }
      if (aRank !== bRank) return aRank - bRank;
      return (b.tested_at ?? "").localeCompare(a.tested_at ?? "");
    })
    .slice(0, limit);
}

export type QaProgressStats = {
  total: number;
  tested: number;
  passes: number;
  bugs: number;
  improves: number;
  open: number;
  taskCount: number;
  pct: number;
};

/** Shared progress stats for detail header / overview (tests only for %). */
export function computeQaProgress(
  items: { item_kind?: "test" | "task" | null; result: QaTestResult | null }[],
): QaProgressStats {
  const testItems = items.filter((i) => (i.item_kind ?? "test") !== "task");
  const taskCount = items.length - testItems.length;
  const total = testItems.length;
  const tested = testItems.filter((i) => i.result != null).length;
  const passes = testItems.filter((i) => i.result === "pass").length;
  const bugs = testItems.filter((i) => i.result === "bug").length;
  const improves = testItems.filter((i) => i.result === "improve").length;
  const open = bugs + improves;
  const pct = total > 0 ? Math.round((tested / total) * 100) : 0;
  return { total, tested, passes, bugs, improves, open, taskCount, pct };
}
