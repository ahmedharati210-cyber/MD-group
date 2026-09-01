import "server-only";

import ExcelJS from "exceljs";
import {
  computeDayRecord,
  parseTimeToMinutes,
} from "@/lib/attendance/monthly-calculations";
import {
  computeSessionRecord,
  type FullTimeConfig,
} from "@/lib/attendance/shift-matching";
import { inferLastPunchDate } from "@/lib/attendance/session-from-record";
import {
  customSchedulePayloadSnapshot,
  isSyntheticCustomShiftId,
  personToSyntheticShift,
} from "@/lib/attendance/person-schedule";
import type { AttendancePerson, AttendanceShift } from "@/types/db";
import {
  rosterEntriesFromBlocks,
  type ImportRosterEntry,
} from "@/lib/attendance/import-roster";

export type RawEmployeeBlock = {
  externalEmployeeNumber: string;
  employeeName: string;
  departmentHint: string | null;
  rows: RawDayRow[];
};

export type RawDayRow = {
  date: string;
  dayName: string | null;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  totalTime: string | null;
};

export type ParseResult = {
  blocks: RawEmployeeBlock[];
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
    // Excel serial day count since 1899-12-30 (date-only, timezone-independent).
    const wholeDays = Math.floor(value);
    const date = new Date(Date.UTC(1899, 11, 30 + wholeDays));
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }
  const text = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [d, mo, y] = text.split("/");
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return text || null;
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ");
  return (
    joined.includes("التاريخ") &&
    joined.includes("أول تسجيل دخول") &&
    joined.includes("أخر تسجيل خروج")
  );
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

function rowToStrings(row: ExcelJS.Row, maxCol = 8): string[] {
  const out: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    out.push(cellText(row.getCell(c).value));
  }
  return out;
}

/**
 * Parse the raw biometric monthly export (`الأول والأخير...xlsx`).
 */
export async function parseRawAttendanceWorkbook(
  buffer: ArrayBuffer,
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { blocks: [], warnings: ["الملف لا يحتوي على أوراق عمل"] };
  }

  const blocks: RawEmployeeBlock[] = [];
  const warnings: string[] = [];
  let current: RawEmployeeBlock | null = null;
  let readingData = false;
  let colMap: {
    date?: number;
    day?: number;
    checkIn?: number;
    checkOut?: number;
    total?: number;
  } = {};

  function findDateInRow(row: ExcelJS.Row, cells: string[]): string | null {
    if (colMap.date) {
      const fromCol = excelDateToIso(row.getCell(colMap.date).value);
      if (fromCol) return fromCol;
    }
    for (let c = 1; c <= cells.length; c++) {
      const iso = excelDateToIso(row.getCell(c).value);
      if (iso) return iso;
      if (/^\d{4}-\d{2}-\d{2}$/.test(cells[c - 1] ?? "")) return cells[c - 1];
    }
    return null;
  }

  sheet.eachRow((row) => {
    const cells = rowToStrings(row, 12);
    const joined = cells.filter(Boolean).join(" ");

    const header = parseEmployeeHeader(joined);
    if (header) {
      current = {
        externalEmployeeNumber: header.externalEmployeeNumber,
        employeeName: header.employeeName,
        departmentHint: header.departmentHint,
        rows: [],
      };
      blocks.push(current);
      readingData = false;
      colMap = {};
      return;
    }

    if (!current) return;

    if (isHeaderRow(cells)) {
      colMap = {};
      cells.forEach((label, idx) => {
        const col = idx + 1;
        if (label.includes("التاريخ")) colMap.date = col;
        if (label.includes("اليوم")) colMap.day = col;
        if (label.includes("أول تسجيل دخول")) colMap.checkIn = col;
        if (label.includes("أخر تسجيل خروج")) colMap.checkOut = col;
        if (label.includes("الوقت الإجمالي")) colMap.total = col;
      });
      readingData = true;
      return;
    }

    if (!readingData) return;

    const date = findDateInRow(row, cells);
    if (!date) return;

    const dayName =
      (colMap.day ? cellText(row.getCell(colMap.day).value) : null) ||
      cellText(row.getCell(2).value) ||
      null;
    // Only fall back to positional columns when headers were not mapped — never
    // treat an empty mapped cell as "read the weekday/date neighbor".
    const parsedFirst = colMap.checkIn
      ? excelTimeToHHMM(row.getCell(colMap.checkIn).value)
      : excelTimeToHHMM(row.getCell(3).value);
    const parsedLast = colMap.checkOut
      ? excelTimeToHHMM(row.getCell(colMap.checkOut).value)
      : excelTimeToHHMM(row.getCell(4).value);
    const parsedTotal = colMap.total
      ? cellText(row.getCell(colMap.total).value) || null
      : null;

    if (!parsedFirst && !parsedLast) return;

    current.rows.push({
      date,
      dayName,
      firstCheckIn: parsedFirst,
      lastCheckOut: parsedLast,
      totalTime: parsedTotal,
    });
  });

  if (blocks.length === 0) {
    warnings.push("لم يتم العثور على كتل موظفين في الملف");
  }

  return { blocks, warnings };
}

export type MatchedImportRow = RawDayRow & {
  externalEmployeeNumber: string;
  employeeName: string;
  departmentHint: string | null;
  attendancePersonId: string | null;
  isNewPerson: boolean;
  computed: ReturnType<typeof computeDayRecord>;
  totalMinutes: number | null;
  shiftId?: string | null;
  punchCount?: number | null;
  rawPayload?: Record<string, unknown> | null;
};

export function matchBlocksToAttendancePeople(
  blocks: RawEmployeeBlock[],
  peopleByExternal: Map<string, AttendancePerson | { id: string; full_name: string }>,
  shifts: AttendanceShift[] = [],
  fullTimeConfig?: FullTimeConfig,
): {
  rows: MatchedImportRow[];
  warnings: string[];
  rosterEntries: ImportRosterEntry[];
} {
  const rows: MatchedImportRow[] = [];
  const warnings: string[] = [];
  const rosterEntries = rosterEntriesFromBlocks(blocks, peopleByExternal);

  for (const block of blocks) {
    const ext = block.externalEmployeeNumber?.trim();
    if (!ext) {
      warnings.push(`كتلة بدون رقم موظف: ${block.employeeName || "غير معروف"}`);
      continue;
    }
    if (!block.employeeName?.trim()) {
      warnings.push(`رقم ${ext}: الاسم فارغ`);
    }

    const personEntry = peopleByExternal.get(ext) ?? null;
    const person =
      personEntry && "company_id" in personEntry
        ? (personEntry as AttendancePerson)
        : null;
    const isNewPerson = !personEntry;

    for (const day of block.rows) {
      const lastPunchDate = inferLastPunchDate(
        day.date,
        day.firstCheckIn,
        day.lastCheckOut,
        day.date,
      );
      const session = {
        shiftDate: day.date,
        firstCheckIn: day.firstCheckIn,
        lastCheckOut: day.lastCheckOut,
        firstPunchDate: day.date,
        lastPunchDate,
        punchCount:
          day.firstCheckIn &&
          day.lastCheckOut &&
          day.firstCheckIn !== day.lastCheckOut
            ? 2
            : 1,
        allPunchTimes: [
          ...(day.firstCheckIn
            ? [{ date: day.date, time: day.firstCheckIn }]
            : []),
          ...(day.lastCheckOut
            ? [{ date: lastPunchDate, time: day.lastCheckOut }]
            : []),
        ],
      };

      const preferredShift = person ? personToSyntheticShift(person) : null;
      const { computed, shift } = computeSessionRecord(
        session,
        shifts,
        fullTimeConfig,
        preferredShift,
      );
      const persistedShiftId =
        shift && !isSyntheticCustomShiftId(shift.id) ? shift.id : null;

      const totalMinutes =
        computed.totalMinutes ??
        (day.firstCheckIn && day.lastCheckOut
          ? (parseTimeToMinutes(day.lastCheckOut) ?? 0) -
            (parseTimeToMinutes(day.firstCheckIn) ?? 0)
          : null);

      rows.push({
        ...day,
        externalEmployeeNumber: ext,
        employeeName: personEntry?.full_name ?? block.employeeName,
        departmentHint: block.departmentHint,
        attendancePersonId: personEntry?.id ?? null,
        isNewPerson,
        computed,
        totalMinutes,
        shiftId: persistedShiftId,
        punchCount: session.punchCount,
        rawPayload: {
          department_hint: block.departmentHint,
          day_name: day.dayName,
          total_time: day.totalTime,
          first_punch_date: day.date,
          last_punch_date: lastPunchDate,
          ...(preferredShift && person
            ? { custom_schedule: customSchedulePayloadSnapshot(person) }
            : {}),
        },
      });
    }
  }

  return { rows, warnings, rosterEntries };
}

/** @deprecated Use matchBlocksToAttendancePeople */
export function matchBlocksToProfiles(
  blocks: RawEmployeeBlock[],
  profilesByExternal: Map<string, { id: string; full_name: string }>,
): { rows: MatchedImportRow[]; unmatchedEmployees: string[] } {
  const { rows, warnings } = matchBlocksToAttendancePeople(
    blocks,
    profilesByExternal,
  );
  const unmatchedEmployees = [
    ...new Set(
      rows.filter((r) => r.isNewPerson).map((r) => `${r.employeeName} (${r.externalEmployeeNumber})`),
    ),
  ];
  return { rows, unmatchedEmployees: [...unmatchedEmployees, ...warnings] };
}
