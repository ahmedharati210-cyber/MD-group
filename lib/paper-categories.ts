import type { DocumentCategory } from "@/types/db";

/** Primary categories shown in stats, filters, and upload/edit forms. */
export const PAPER_STAT_CATEGORIES = [
  "record",
  "license",
  "stats_code",
  "contract",
  "other",
] as const satisfies readonly DocumentCategory[];

export type PaperStatCategory = (typeof PAPER_STAT_CATEGORIES)[number];

export const paperCategoryLabel: Record<string, string> = {
  record: "سجل",
  license: "رخصة",
  stats_code: "غرفة رمز الاحصاء",
  contract: "عقد",
  other: "أخرى",
  // Legacy values (existing rows + employee RLS)
  letter: "مراسلة",
  memo: "مذكرة",
  personal: "شخصي",
};

export function paperCategoryLabelFor(category: string): string {
  return paperCategoryLabel[category] ?? category;
}
