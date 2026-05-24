import type { DocumentCategory } from "@/types/db";

/** Primary categories shown in filters and upload/edit forms. */
export const PAPER_STAT_CATEGORIES = [
  "record",
  "license",
  "chamber",
  "statistics_code",
  "contract",
  "other",
] as const satisfies readonly DocumentCategory[];

export type PaperStatCategory = (typeof PAPER_STAT_CATEGORIES)[number];

export const paperCategoryLabel: Record<string, string> = {
  record: "سجل",
  license: "رخصة",
  chamber: "غرفة",
  statistics_code: "رمز الاحصاء",
  contract: "عقد",
  other: "أخرى",
  // Legacy / deprecated combined value (pre-split)
  stats_code: "غرفة / رمز الاحصاء (قديم)",
  letter: "مراسلة",
  memo: "مذكرة",
  personal: "شخصي",
};

export function paperCategoryLabelFor(category: string): string {
  return paperCategoryLabel[category] ?? category;
}
