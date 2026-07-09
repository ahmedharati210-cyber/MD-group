import "server-only";

import ExcelJS from "exceljs";
import {
  daysInMonth,
  enumerateMonthDays,
  formatMinutesAsHours,
  formatOvertimeDisplay,
  parseMonthParam,
} from "@/lib/attendance/monthly-calculations";
import { formatAttendanceRecordNotes } from "@/lib/attendance/leave-types";
import type { AttendanceBranch, AttendanceMonthlyRecord } from "@/types/db";

const AR_DAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function dayNameAr(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return AR_DAYS[d.getDay()] ?? "";
}

function timeOrEmpty(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

type EmployeeExportGroup = {
  externalEmployeeNumber: string;
  employeeName: string;
  recordsByDate: Map<string, AttendanceMonthlyRecord>;
};

function groupRecords(records: AttendanceMonthlyRecord[]): EmployeeExportGroup[] {
  const map = new Map<string, EmployeeExportGroup>();
  for (const r of records) {
    let group = map.get(r.external_employee_number);
    if (!group) {
      group = {
        externalEmployeeNumber: r.external_employee_number,
        employeeName: r.employee_name,
        recordsByDate: new Map(),
      };
      map.set(r.external_employee_number, group);
    }
    group.recordsByDate.set(r.date, r);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "ar"),
  );
}

function safeSheetName(name: string, number: string): string {
  const base = `${name} ${number}`.slice(0, 31);
  return base.replace(/[\\/*?:[\]]/g, "-");
}

export async function buildMonthlyAttendanceWorkbook(options: {
  companyName: string;
  branch: AttendanceBranch;
  month: string;
  records: AttendanceMonthlyRecord[];
}): Promise<Buffer> {
  const parsed = parseMonthParam(options.month.slice(0, 7));
  if (!parsed) throw new Error("شهر غير صالح");

  const { year, month } = parsed;
  const monthDays = enumerateMonthDays(year, month);
  const groups = groupRecords(options.records);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MD Group Portal";
  workbook.created = new Date();

  for (const group of groups) {
    const sheetName = safeSheetName(
      group.employeeName,
      group.externalEmployeeNumber,
    );
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true }],
    });

    sheet.mergeCells("A1:J1");
    sheet.getCell("A2").value =
      `${options.companyName}/ ${options.branch.name}`;
    sheet.mergeCells("A2:J2");
    sheet.getCell("A3").value = `${group.employeeName}  ${group.externalEmployeeNumber}`;
    sheet.mergeCells("A3:J3");

    const headers = [
      "م",
      "التاريخ",
      "اليوم",
      "أول تسجيل دخول",
      "أخر تسجيل خروج",
      "الوقت الإجمالي",
      "نوع الدوام",
      "الساعات المطلوبة",
      "زيادة / نقص",
      "دقائق التأخير",
      "خروج مبكر",
      "ساعات الخصم",
      "ملاحظات",
    ];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true };
    });

    let rowIdx = 6;
    let absenceCount = 0;
    let lateDays = 0;
    let earlyDays = 0;
    let overtimeDays = 0;
    let totalDeduction = 0;

    monthDays.forEach((date, index) => {
      const rec = group.recordsByDate.get(date);
      const row = sheet.getRow(rowIdx);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = date;
      row.getCell(3).value = dayNameAr(date);

      if (rec) {
        row.getCell(4).value = timeOrEmpty(rec.first_check_in);
        row.getCell(5).value = timeOrEmpty(rec.last_check_out);
        row.getCell(6).value =
          rec.total_minutes != null
            ? formatMinutesAsHours(rec.total_minutes)
            : "";
        row.getCell(7).value = rec.shift_type ?? "";
        row.getCell(8).value =
          rec.expected_minutes != null
            ? formatMinutesAsHours(rec.expected_minutes)
            : "";
        row.getCell(9).value = formatOvertimeDisplay(
          rec.total_minutes,
          rec.expected_minutes,
        );
        row.getCell(10).value = rec.late_minutes || "";
        row.getCell(11).value = rec.early_leave_minutes || "";
        row.getCell(12).value =
          rec.deduction_minutes > 0
            ? formatMinutesAsHours(rec.deduction_minutes)
            : "";
        row.getCell(13).value = formatAttendanceRecordNotes(rec);

        if (rec.is_absent) absenceCount += 1;
        if (rec.late_minutes > 0) lateDays += 1;
        if (rec.early_leave_minutes > 0) earlyDays += 1;
        if (rec.overtime_minutes > 0) overtimeDays += 1;
        totalDeduction += rec.deduction_minutes;
      }

      rowIdx += 1;
    });

    const summaryStart = rowIdx + 1;
    sheet.getCell(`A${summaryStart}`).value = "ملخص الشهر";
    sheet.getCell(`B${summaryStart}`).value = `أيام الغياب: ${absenceCount}`;
    sheet.getCell(`B${summaryStart + 1}`).value = `أيام التأخير: ${lateDays}`;
    sheet.getCell(`B${summaryStart + 2}`).value = `أيام الخروج المبكر: ${earlyDays}`;
    sheet.getCell(`B${summaryStart + 3}`).value = `أيام الزيادة: ${overtimeDays}`;
    sheet.getCell(`B${summaryStart + 4}`).value =
      `إجمالي ساعات الخصم: ${formatMinutesAsHours(totalDeduction)}`;

    sheet.columns.forEach((col) => {
      col.width = 14;
    });
  }

  if (groups.length === 0) {
    const sheet = workbook.addWorksheet("فارغ", { views: [{ rightToLeft: true }] });
    sheet.getCell("A1").value = "لا توجد سجلات لهذا الشهر";
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function monthExportFileName(
  companyName: string,
  branchName: string,
  month: string,
): string {
  const [y, m] = month.slice(0, 7).split("-");
  return `تقرير الحضور - ${companyName} ${branchName} - ${m}-${y}.xlsx`;
}

export { daysInMonth, enumerateMonthDays };
