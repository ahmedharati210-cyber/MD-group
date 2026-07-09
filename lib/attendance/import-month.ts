/** Client-safe helpers for attendance import month detection and defaults. */

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export type MonthMismatchInfo = {
  detectedMonth: string;
  selectedMonth: string;
  message: string;
};

export function getDefaultAttendanceMonth(reference = new Date()): string {
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  if (monthIndex === 0) {
    return `${year - 1}-12`;
  }
  return `${year}-${String(monthIndex).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return month;
  return `${ARABIC_MONTHS[monthIndex]} ${year}`;
}

export function detectDominantMonthFromDates(dates: string[]): string | null {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const month = date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let dominant: string | null = null;
  let max = 0;
  for (const [month, count] of counts) {
    if (count > max) {
      max = count;
      dominant = month;
    }
  }
  return dominant;
}

export function detectImportMonthMismatch(
  selectedMonth: string,
  dates: string[],
): MonthMismatchInfo | null {
  const detectedMonth = detectDominantMonthFromDates(dates);
  if (!detectedMonth || detectedMonth === selectedMonth) return null;

  return {
    detectedMonth,
    selectedMonth,
    message: `هذا الملف يحتوي على بيانات لشهر ${formatMonthLabel(detectedMonth)}، لكن الشهر المحدد هو ${formatMonthLabel(selectedMonth)}.`,
  };
}
