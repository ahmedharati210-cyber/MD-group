import "server-only";

import ExcelJS from "exceljs";

export type AttendanceFileFormat = "per_day" | "raw_punch_log" | "unknown";

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

/**
 * Detect biometric export format from workbook headers.
 */
export async function detectAttendanceFileFormat(
  buffer: ArrayBuffer,
): Promise<AttendanceFileFormat> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return "unknown";

  let joined = "";
  let rowCount = 0;
  sheet.eachRow((row) => {
    if (rowCount >= 25) return;
    rowCount += 1;
    const cells: string[] = [];
    for (let c = 1; c <= 10; c++) {
      cells.push(cellText(row.getCell(c).value));
    }
    joined += ` ${cells.join(" ")}`;
  });

  if (
    joined.includes("أول تسجيل دخول") &&
    joined.includes("أخر تسجيل خروج")
  ) {
    return "per_day";
  }

  if (
    joined.includes("مصدر البيانات") &&
    joined.includes("رمز العمل") &&
    joined.includes("حالة البصمة")
  ) {
    return "raw_punch_log";
  }

  return "unknown";
}
