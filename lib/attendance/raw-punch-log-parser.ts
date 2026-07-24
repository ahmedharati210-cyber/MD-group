import "server-only";

import ExcelJS from "exceljs";
import type { RawPunch } from "@/lib/attendance/punch-sessions";

export type RawPunchBlock = {
  externalEmployeeNumber: string;
  employeeName: string;
  departmentHint: string | null;
  punches: RawPunch[];
};

export type RawPunchLogParseResult = {
  blocks: RawPunchBlock[];
  warnings: string[];
};

const EMPLOYEE_HEADER_RE =
  /رقم\s*الموظف\s*[:：]\s*([^,،]+)[,،]\s*الإسم\s*الأول\s*[:：]\s*([^,،]+)(?:[,،]\s*القسم\s*[:：]\s*(.+))?/;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value && value.text) {
    return String(value.text).trim();
  }
  if (typeof value === "object" && "result" in value && value.result != null) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text ?? "").join("").trim();
  }
  return String(value).trim();
}

function excelTimeToHHMM(value: ExcelJS.CellValue): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const [h, m] = trimmed.split(":");
      return `${String(h).padStart(2, "0")}:${m}`;
    }
    return trimmed || null;
  }
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return cellText(value) || null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date-only Excel values: prefer UTC midnight components, else local calendar day. */
function excelDateToIso(value: ExcelJS.CellValue): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const isUtcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    if (isUtcMidnight) {
      return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
    }
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value === "number") {
    const wholeDays = Math.floor(value);
    const date = new Date(Date.UTC(1899, 11, 30 + wholeDays));
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return text || null;
}

function parseEmployeeHeader(text: string): {
  externalEmployeeNumber: string;
  employeeName: string;
  departmentHint: string | null;
} | null {
  const match = text.match(EMPLOYEE_HEADER_RE);
  if (!match) return null;
  return {
    externalEmployeeNumber: match[1].trim(),
    employeeName: match[2].trim(),
    departmentHint: match[3]?.trim() ?? null,
  };
}

function isPunchHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ");
  return (
    joined.includes("مصدر البيانات") &&
    joined.includes("رمز العمل") &&
    joined.includes("حالة البصمة")
  );
}

function rowToStrings(row: ExcelJS.Row, maxCol = 8): string[] {
  const out: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    out.push(cellText(row.getCell(c).value));
  }
  return out;
}

/**
 * Parse raw fingerprint log export (`السجلات ...xlsx`).
 */
export async function parseRawPunchLogWorkbook(
  buffer: ArrayBuffer,
): Promise<RawPunchLogParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { blocks: [], warnings: ["الملف لا يحتوي على أوراق عمل"] };
  }

  const blocks: RawPunchBlock[] = [];
  const warnings: string[] = [];
  let current: RawPunchBlock | null = null;
  let readingData = false;
  let colMap: { source?: number; time?: number; date?: number } = {};

  sheet.eachRow((row) => {
    const cells = rowToStrings(row, 10);
    const joined = cells.filter(Boolean).join(" ");

    const header = parseEmployeeHeader(joined);
    if (header) {
      current = {
        externalEmployeeNumber: header.externalEmployeeNumber,
        employeeName: header.employeeName,
        departmentHint: header.departmentHint,
        punches: [],
      };
      blocks.push(current);
      readingData = false;
      colMap = {};
      return;
    }

    if (!current) return;

    if (isPunchHeaderRow(cells)) {
      colMap = {};
      cells.forEach((label, idx) => {
        const col = idx + 1;
        if (label.includes("مصدر البيانات")) colMap.source = col;
        if (label === "الوقت" || label.includes("الوقت")) colMap.time = col;
        if (label.includes("التاريخ")) colMap.date = col;
      });
      readingData = true;
      return;
    }

    if (!readingData) return;

    const source =
      (colMap.source ? cellText(row.getCell(colMap.source).value) : cells[0]) || "";
    if (source !== "الجهاز" && source !== "Device") return;

    const time =
      (colMap.time ? excelTimeToHHMM(row.getCell(colMap.time).value) : null) ??
      excelTimeToHHMM(row.getCell(4).value);
    const date =
      (colMap.date ? excelDateToIso(row.getCell(colMap.date).value) : null) ??
      excelDateToIso(row.getCell(5).value);

    if (!time || !date) return;

    current.punches.push({ date, time });
  });

  if (blocks.length === 0) {
    warnings.push("لم يتم العثور على كتل موظفين في الملف");
  }

  return { blocks, warnings };
}
