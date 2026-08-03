/**
 * Load attendance spreadsheet buffers as a string matrix.
 * Supports legacy .xls (OLE) via SheetJS and .xlsx via ExcelJS.
 */

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/** OLE Compound File magic: D0 CF 11 E0 */
export function isOleCompoundFile(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer, 0, 4);
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function excelJsCellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "text" in value && value.text) {
    return String(value.text).trim();
  }
  if (typeof value === "object" && "result" in value && value.result != null) {
    return excelJsCellText(value.result as ExcelJS.CellValue);
  }
  if (
    typeof value === "object" &&
    "richText" in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText.map((r) => r.text ?? "").join("").trim();
  }
  return String(value).trim();
}

function sheetJsCellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    if (hh === "00" && mm === "00") return `${y}-${m}-${d}`;
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }
  return String(value).replace(/\r\n/g, "\n").trim();
}

export function sheetJsWorkbookToMatrix(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    },
  );

  return rows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => sheetJsCellText(cell)),
  );
}

export async function excelJsWorkbookToMatrix(
  buffer: ArrayBuffer,
): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    while (matrix.length < rowNumber) matrix.push([]);
    const cells: string[] = [];
    const maxCol = Math.max(row.cellCount, 14);
    for (let c = 1; c <= maxCol; c++) {
      cells.push(excelJsCellText(row.getCell(c).value));
    }
    matrix[rowNumber - 1] = cells;
  });
  return matrix;
}

/**
 * Load the first sheet as a string matrix.
 * Prefer SheetJS for OLE .xls; ExcelJS for modern .xlsx.
 */
export async function loadAttendanceSheetMatrix(
  buffer: ArrayBuffer,
): Promise<string[][]> {
  if (isOleCompoundFile(buffer)) {
    return sheetJsWorkbookToMatrix(buffer);
  }
  try {
    return await excelJsWorkbookToMatrix(buffer);
  } catch {
    // Some mislabeled buffers still parse as SheetJS workbooks.
    return sheetJsWorkbookToMatrix(buffer);
  }
}
