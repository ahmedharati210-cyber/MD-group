/**
 * Verification script for raw biometric Excel parsing (no Next.js runtime).
 * Usage: node --import tsx scripts/verify-attendance-import.mjs <raw.xlsx>
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

const EMPLOYEE_HEADER_RE =
  /رقم\s*الموظف\s*[:：]\s*([^,،]+)[,،]\s*الإسم\s*الأول\s*[:：]\s*([^,،]+)(?:[,،]\s*القسم\s*[:：]\s*(.+))?/;

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value.text) return String(value.text).trim();
  if (typeof value === "object" && value.result != null) return cellText(value.result);
  if (typeof value === "object" && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text ?? "").join("").trim();
  }
  return String(value).trim();
}

function parseEmployeeHeader(text) {
  const match = text.match(EMPLOYEE_HEADER_RE);
  if (!match) return null;
  return {
    externalEmployeeNumber: match[1].trim(),
    employeeName: match[2].trim(),
    departmentHint: match[3]?.trim() ?? null,
  };
}

function isHeaderRow(cells) {
  const joined = cells.join(" ");
  return (
    joined.includes("التاريخ") &&
    joined.includes("أول تسجيل دخول") &&
    joined.includes("أخر تسجيل خروج")
  );
}

async function parseRaw(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const blocks = [];
  let current = null;
  let readingData = false;

  sheet.eachRow((row) => {
    const cells = [];
    for (let c = 1; c <= 8; c++) cells.push(cellText(row.getCell(c).value));
    const joined = cells.filter(Boolean).join(" ");
    const header = parseEmployeeHeader(joined);
    if (header) {
      current = { ...header, rows: [] };
      blocks.push(current);
      readingData = false;
      return;
    }
    if (!current) return;
    if (isHeaderRow(cells)) {
      readingData = true;
      return;
    }
    if (!readingData) return;
    const dateText = cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c));
    if (!dateText) return;
    current.rows.push({ date: dateText });
  });

  return blocks;
}

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node --import tsx scripts/verify-attendance-import.mjs <raw.xlsx>");
  process.exit(1);
}

const buffer = readFileSync(filePath).buffer;
const blocks = await parseRaw(buffer);
console.log(`Blocks: ${blocks.length}`);
for (const block of blocks.slice(0, 5)) {
  console.log(`- ${block.employeeName} #${block.externalEmployeeNumber} (${block.rows.length} days)`);
}
console.log(`Total day rows: ${blocks.reduce((n, b) => n + b.rows.length, 0)}`);
