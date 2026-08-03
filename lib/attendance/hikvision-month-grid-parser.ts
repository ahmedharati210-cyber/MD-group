import type { RawPunch } from "@/lib/attendance/punch-sessions";
import type { RawPunchBlock } from "@/lib/attendance/raw-punch-log-parser";
import { loadAttendanceSheetMatrix } from "@/lib/attendance/workbook-load";

export type HikvisionMonthGridParseResult = {
  blocks: RawPunchBlock[];
  warnings: string[];
  periodStart: string | null;
  periodEnd: string | null;
};

const MADE_DATE_RE =
  /Made\s*Date\s*:\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/i;

const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeTimeToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const match = trimmed.match(TIME_RE);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

export function parseTimesFromDayCell(cell: string): string[] {
  if (!cell?.trim()) return [];
  const parts = cell.split(/[\n\r]+|\s+/);
  const times: string[] = [];
  for (const part of parts) {
    const time = normalizeTimeToken(part);
    if (time) times.push(time);
  }
  return times;
}

export function parseMadeDateRange(
  text: string,
): { start: string; end: string; year: number; month: number } | null {
  const match = text.match(MADE_DATE_RE);
  if (!match) return null;
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const startDay = Number(match[3]);
  const endYear = Number(match[4]);
  const endMonth = Number(match[5]);
  const endDay = Number(match[6]);
  return {
    start: formatIsoDate(startYear, startMonth, startDay),
    end: formatIsoDate(endYear, endMonth, endDay),
    year: startYear,
    month: startMonth,
  };
}

function findHeaderRow(matrix: string[][]): number {
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const joined = row.join(" ").toLowerCase();
    if (
      joined.includes("employee id") &&
      joined.includes("name") &&
      joined.includes("department")
    ) {
      return r;
    }
  }
  return -1;
}

function columnIndex(row: string[], label: string): number {
  const target = label.toLowerCase();
  return row.findIndex((cell) => cell.trim().toLowerCase() === target);
}

function isSeparatorRow(
  employeeId: string,
  name: string,
  department: string,
): boolean {
  if (!employeeId) return true;
  if (department.trim().toLowerCase() === "company") return true;
  if (!name.trim()) return true;
  return false;
}

/**
 * Parse a Hikvision month-grid matrix into punch blocks.
 */
export function parseHikvisionMonthGridMatrix(
  matrix: string[][],
): HikvisionMonthGridParseResult {
  const warnings: string[] = [];
  const blocks: RawPunchBlock[] = [];

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let year = 0;
  let month = 0;

  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const joined = (matrix[r] ?? []).join(" ");
    const made = parseMadeDateRange(joined);
    if (made) {
      periodStart = made.start;
      periodEnd = made.end;
      year = made.year;
      month = made.month;
      if (
        made.start.slice(0, 7) !== made.end.slice(0, 7)
      ) {
        warnings.push(
          `فترة Made Date تمتد على أكثر من شهر (${made.start} – ${made.end})؛ سيتم استخدام شهر البداية ${made.start.slice(0, 7)}.`,
        );
      }
      break;
    }
  }

  if (!year || !month) {
    return {
      blocks: [],
      warnings: ["تعذر قراءة Made Date من ملف Hikvision"],
      periodStart: null,
      periodEnd: null,
    };
  }

  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex < 0) {
    return {
      blocks: [],
      warnings: ["تعذر العثور على صف العناوين (Employee ID / Name / Department)"],
      periodStart,
      periodEnd,
    };
  }

  const header = matrix[headerRowIndex] ?? [];
  const idCol = columnIndex(header, "Employee ID");
  const nameCol = columnIndex(header, "Name");
  const deptCol = columnIndex(header, "Department");
  if (idCol < 0 || nameCol < 0) {
    return {
      blocks: [],
      warnings: ["أعمدة Employee ID أو Name غير موجودة"],
      periodStart,
      periodEnd,
    };
  }

  const maxDay = daysInMonth(year, month);
  const dayColumns: Array<{ col: number; day: number; date: string }> = [];
  for (let c = 0; c < header.length; c++) {
    const label = header[c]?.trim() ?? "";
    if (!/^\d{1,2}$/.test(label)) continue;
    const day = Number(label);
    if (day < 1 || day > maxDay) continue;
    dayColumns.push({
      col: c,
      day,
      date: formatIsoDate(year, month, day),
    });
  }

  if (dayColumns.length === 0) {
    return {
      blocks: [],
      warnings: ["لم يتم العثور على أعمدة الأيام (1–31)"],
      periodStart,
      periodEnd,
    };
  }

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const employeeId = String(row[idCol] ?? "").trim();
    const employeeName = String(row[nameCol] ?? "").trim();
    const department =
      deptCol >= 0 ? String(row[deptCol] ?? "").trim() : "";

    if (isSeparatorRow(employeeId, employeeName, department)) {
      continue;
    }

    const punches: RawPunch[] = [];
    for (const dayCol of dayColumns) {
      const cell = String(row[dayCol.col] ?? "");
      for (const time of parseTimesFromDayCell(cell)) {
        punches.push({ date: dayCol.date, time });
      }
    }

    if (punches.length === 0) {
      warnings.push(
        `رقم ${employeeId} (${employeeName}): لا توجد بصمات في الملف`,
      );
    }

    blocks.push({
      externalEmployeeNumber: employeeId,
      employeeName,
      departmentHint: department || null,
      punches,
    });
  }

  if (blocks.length === 0) {
    warnings.push("لم يتم العثور على موظفين في ملف Hikvision");
  }

  return { blocks, warnings, periodStart, periodEnd };
}

export async function parseHikvisionMonthGridWorkbook(
  buffer: ArrayBuffer,
): Promise<HikvisionMonthGridParseResult> {
  const matrix = await loadAttendanceSheetMatrix(buffer);
  return parseHikvisionMonthGridMatrix(matrix);
}
