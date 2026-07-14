import "server-only";

import ExcelJS from "exceljs";
import {
  buildEmployeeMonthFooterLines,
  DAILY_COLUMN_HEADERS,
  type AttendanceReportPayload,
  formatReportHours,
  REPORT_LABELS,
  reportFileName,
} from "@/lib/attendance/attendance-report";
import type { BranchPayrollTotals, PersonPayrollSummary } from "@/lib/attendance/attendance-view";
import { enumerateMonthDays, parseMonthParam } from "@/lib/attendance/monthly-calculations";

function safeSheetName(name: string, number: string): string {
  const base = `${name} ${number}`.slice(0, 31);
  return base.replace(/[\\/*?:[\]]/g, "-");
}

function writeSummarySheet(
  workbook: ExcelJS.Workbook,
  payload: AttendanceReportPayload,
): void {
  const sheet = workbook.addWorksheet(REPORT_LABELS.branchSummary, {
    views: [{ rightToLeft: true }],
  });

  sheet.getCell("A1").value = `${payload.meta.companyName} / ${payload.meta.branchName}`;
  sheet.getCell("A2").value = payload.meta.monthLabel;

  const headers = [
    REPORT_LABELS.employee,
    REPORT_LABELS.employeeNumber,
    REPORT_LABELS.fullTimeDays,
    REPORT_LABELS.absentDays,
    REPORT_LABELS.onePunchDays,
    REPORT_LABELS.leaveDays,
    REPORT_LABELS.lateDays,
    REPORT_LABELS.earlyLeaveDays,
    REPORT_LABELS.overtimeDays,
    REPORT_LABELS.workedHours,
    REPORT_LABELS.expectedHours,
    REPORT_LABELS.deductionHours,
  ];

  const headerRow = sheet.getRow(4);
  headers.forEach((label, index) => {
    headerRow.getCell(index + 1).value = label;
    headerRow.getCell(index + 1).font = { bold: true };
  });

  payload.summary.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    writeSummaryRow(excelRow, row);
  });

  const totalsRow = sheet.getRow(5 + payload.summary.rows.length);
  totalsRow.getCell(1).value = REPORT_LABELS.total;
  totalsRow.getCell(1).font = { bold: true };
  writeSummaryTotals(totalsRow, payload.summary.totals);

  sheet.columns.forEach((col) => {
    col.width = 14;
  });
}

function writeSummaryRow(row: ExcelJS.Row, data: PersonPayrollSummary): void {
  row.getCell(1).value = data.employeeName;
  row.getCell(2).value = data.externalEmployeeNumber;
  row.getCell(3).value = data.fullTimeDays;
  row.getCell(4).value = data.absentDays;
  row.getCell(5).value = data.onePunchDays;
  row.getCell(6).value = data.leaveDays;
  row.getCell(7).value = data.lateDays;
  row.getCell(8).value = data.earlyLeaveDays;
  row.getCell(9).value = data.overtimeDays;
  row.getCell(10).value = formatReportHours(data.totalWorkedMinutes);
  row.getCell(11).value = formatReportHours(data.totalExpectedMinutes);
  row.getCell(12).value = formatReportHours(data.totalDeductionMinutes);
}

function writeSummaryTotals(row: ExcelJS.Row, totals: BranchPayrollTotals): void {
  row.getCell(3).value = totals.fullTimeDays;
  row.getCell(4).value = totals.absentDays;
  row.getCell(5).value = totals.onePunchDays;
  row.getCell(6).value = totals.leaveDays;
  row.getCell(7).value = totals.lateDays;
  row.getCell(8).value = totals.earlyLeaveDays;
  row.getCell(9).value = totals.overtimeDays;
  row.getCell(10).value = formatReportHours(totals.totalWorkedMinutes);
  row.getCell(11).value = formatReportHours(totals.totalExpectedMinutes);
  row.getCell(12).value = formatReportHours(totals.totalDeductionMinutes);
  row.font = { bold: true };
}

function writeEmployeeSheet(
  workbook: ExcelJS.Workbook,
  payload: AttendanceReportPayload,
  employee: AttendanceReportPayload["employees"][number],
): void {
  const sheetName = safeSheetName(
    employee.employeeName,
    employee.externalEmployeeNumber,
  );
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true }],
  });

  sheet.getCell("A1").value =
    `${payload.meta.companyName} / ${payload.meta.branchName}`;
  sheet.getCell("A2").value = payload.meta.monthLabel;
  sheet.getCell("A3").value =
    `${employee.employeeName}  ${employee.externalEmployeeNumber}`;

  const headerRow = sheet.getRow(5);
  DAILY_COLUMN_HEADERS.forEach((label, index) => {
    headerRow.getCell(index + 1).value = label;
    headerRow.getCell(index + 1).font = { bold: true };
  });

  employee.days.forEach((day, index) => {
    const row = sheet.getRow(6 + index);
    row.getCell(1).value = day.index;
    row.getCell(2).value = day.date;
    row.getCell(3).value = day.weekday;
    row.getCell(4).value = day.checkIn;
    row.getCell(5).value = day.checkOut;
    row.getCell(6).value = day.totalTime;
    row.getCell(7).value = day.shiftType;
    row.getCell(8).value = day.expectedHours;
    row.getCell(9).value = day.overtimeDelta;
    row.getCell(10).value = day.lateMinutes;
    row.getCell(11).value = day.earlyLeaveMinutes;
    row.getCell(12).value = day.deductionHours;
    row.getCell(13).value = day.notes;
  });

  const summaryStart = 6 + employee.days.length + 1;
  sheet.getCell(`A${summaryStart}`).value = REPORT_LABELS.monthSummary;
  buildEmployeeMonthFooterLines(employee.payroll).forEach((line, index) => {
    sheet.getCell(`B${summaryStart + index}`).value = line;
  });

  sheet.columns.forEach((col) => {
    col.width = 14;
  });
}

export async function buildMonthlyAttendanceWorkbook(
  payload: AttendanceReportPayload,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MD Group Portal";
  workbook.created = new Date();

  if (payload.employees.length === 0) {
    const sheet = workbook.addWorksheet("فارغ", {
      views: [{ rightToLeft: true }],
    });
    sheet.getCell("A1").value = "لا توجد سجلات لهذا الشهر";
  } else {
    writeSummarySheet(workbook, payload);
    for (const employee of payload.employees) {
      writeEmployeeSheet(workbook, payload, employee);
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function monthExportFileName(
  companyName: string,
  branchName: string,
  month: string,
): string {
  return `${reportFileName(companyName, branchName, month)}.xlsx`;
}

export { enumerateMonthDays, parseMonthParam };
