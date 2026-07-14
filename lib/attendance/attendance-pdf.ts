import "server-only";

import {
  buildEmployeeMonthFooterLines,
  DAILY_COLUMN_HEADERS,
  type AttendanceReportPayload,
  formatReportHours,
  REPORT_LABELS,
  reportFileName,
} from "@/lib/attendance/attendance-report";
import type { BranchPayrollTotals, PersonPayrollSummary } from "@/lib/attendance/attendance-view";
import { escapeHtml } from "@/lib/pdf/render-html-to-pdf";

function shortDate(isoDate: string): string {
  return isoDate.slice(5);
}

function buildSummaryTableHtml(
  rows: PersonPayrollSummary[],
  totals: BranchPayrollTotals,
): string {
  const header = `
    <thead>
      <tr>
        <th>${REPORT_LABELS.employee}</th>
        <th>${REPORT_LABELS.employeeNumber}</th>
        <th>${REPORT_LABELS.fullTimeDays}</th>
        <th>${REPORT_LABELS.absentDays}</th>
        <th>${REPORT_LABELS.onePunchDays}</th>
        <th>${REPORT_LABELS.leaveDays}</th>
        <th>${REPORT_LABELS.lateDays}</th>
        <th>${REPORT_LABELS.earlyLeaveDays}</th>
        <th>${REPORT_LABELS.overtimeDays}</th>
        <th>${REPORT_LABELS.workedHours}</th>
        <th>${REPORT_LABELS.expectedHours}</th>
        <th>${REPORT_LABELS.deductionHours}</th>
      </tr>
    </thead>`;

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td class="name">${escapeHtml(row.employeeName)}</td>
        <td class="ltr">${escapeHtml(row.externalEmployeeNumber)}</td>
        <td>${row.fullTimeDays}</td>
        <td class="red">${row.absentDays}</td>
        <td class="orange">${row.onePunchDays}</td>
        <td class="teal">${row.leaveDays}</td>
        <td class="amber">${row.lateDays}</td>
        <td>${row.earlyLeaveDays}</td>
        <td class="green">${row.overtimeDays}</td>
        <td class="ltr">${formatReportHours(row.totalWorkedMinutes)}</td>
        <td class="ltr">${formatReportHours(row.totalExpectedMinutes)}</td>
        <td class="ltr violet">${formatReportHours(row.totalDeductionMinutes)}</td>
      </tr>`,
    )
    .join("");

  const footer = `
    <tfoot>
      <tr>
        <td colspan="2">${REPORT_LABELS.total}</td>
        <td>${totals.fullTimeDays}</td>
        <td>${totals.absentDays}</td>
        <td>${totals.onePunchDays}</td>
        <td>${totals.leaveDays}</td>
        <td>${totals.lateDays}</td>
        <td>${totals.earlyLeaveDays}</td>
        <td>${totals.overtimeDays}</td>
        <td class="ltr">${formatReportHours(totals.totalWorkedMinutes)}</td>
        <td class="ltr">${formatReportHours(totals.totalExpectedMinutes)}</td>
        <td class="ltr violet">${formatReportHours(totals.totalDeductionMinutes)}</td>
      </tr>
    </tfoot>`;

  return `<table class="summary-table">${header}<tbody>${bodyRows}</tbody>${footer}</table>`;
}

function buildEmployeeHeaderStats(row: PersonPayrollSummary): string {
  return `
    <div class="employee-stats">
      <p class="stats-line">
        ${REPORT_LABELS.fullTimeDays}: <strong>${row.fullTimeDays}</strong>
        · ${REPORT_LABELS.absentDays}: <strong class="red">${row.absentDays}</strong>
        · ${REPORT_LABELS.onePunchDays}: <strong class="orange">${row.onePunchDays}</strong>
        · ${REPORT_LABELS.leaveDays}: <strong class="teal">${row.leaveDays}</strong>
        · ${REPORT_LABELS.lateDays}: <strong class="amber">${row.lateDays}</strong>
        · ${REPORT_LABELS.earlyLeaveDays}: <strong>${row.earlyLeaveDays}</strong>
        · ${REPORT_LABELS.overtimeDays}: <strong class="green">${row.overtimeDays}</strong>
      </p>
      <p class="stats-line">
        ${REPORT_LABELS.workedHours}: <strong class="ltr">${formatReportHours(row.totalWorkedMinutes)}</strong>
        · ${REPORT_LABELS.expectedHours}: <strong class="ltr">${formatReportHours(row.totalExpectedMinutes)}</strong>
        · ${REPORT_LABELS.totalDeductionHours}: <strong class="ltr violet">${formatReportHours(row.totalDeductionMinutes)}</strong>
      </p>
    </div>`;
}

function buildEmployeeFooterStats(row: PersonPayrollSummary): string {
  const lines = buildEmployeeMonthFooterLines(row)
    .map((line) => `<p class="stats-line">${escapeHtml(line)}</p>`)
    .join("");
  return `<div class="employee-footer">${lines}</div>`;
}

function buildEmployeeDailyTableHtml(
  payload: AttendanceReportPayload["employees"][number],
): string {
  const headerCells = DAILY_COLUMN_HEADERS.map(
    (label) => `<th>${escapeHtml(label)}</th>`,
  ).join("");

  const rows = payload.days
    .map(
      (day) => `
      <tr>
        <td class="nowrap">${day.index}</td>
        <td class="ltr nowrap">${escapeHtml(shortDate(day.date))}</td>
        <td class="nowrap">${escapeHtml(day.weekday)}</td>
        <td class="ltr nowrap">${escapeHtml(day.checkIn)}</td>
        <td class="ltr nowrap">${escapeHtml(day.checkOut)}</td>
        <td class="ltr nowrap">${escapeHtml(day.totalTime)}</td>
        <td class="nowrap">${escapeHtml(day.shiftType)}</td>
        <td class="ltr nowrap">${escapeHtml(day.expectedHours)}</td>
        <td class="ltr nowrap">${escapeHtml(day.overtimeDelta)}</td>
        <td class="nowrap">${escapeHtml(day.lateMinutes)}</td>
        <td class="nowrap">${escapeHtml(day.earlyLeaveMinutes)}</td>
        <td class="ltr nowrap">${escapeHtml(day.deductionHours)}</td>
        <td class="notes">${escapeHtml(day.notes)}</td>
      </tr>`,
    )
    .join("");

  return `
    <table class="daily-table">
      <thead>
        <tr>${headerCells}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function pdfStyles(): string {
  return `
    @page { size: A4 portrait; margin: 1.5cm; }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html {
      color-scheme: light only;
    }
    html, body {
      direction: rtl;
      font-family: 'Cairo', 'Arial', sans-serif;
      font-size: 10pt;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .page-header {
      border-bottom: 2px solid #111;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    h1 { font-size: 18pt; font-weight: 700; margin: 0 0 4px; }
    .subtitle { font-size: 10pt; color: #555; margin: 0; }
    .header-meta { text-align: left; font-size: 9pt; color: #666; flex-shrink: 0; }
    h2 { font-size: 13pt; margin: 0 0 10px; }
    h3 { font-size: 11pt; margin: 0 0 6px; }
    .section { margin-bottom: 24px; }
    .details-section {
      break-before: page;
    }
    .employee-section {
      break-before: page;
      break-inside: avoid;
      margin-top: 0;
      padding-top: 0;
    }
    .employee-section:first-of-type {
      break-before: auto;
    }
    .employee-stats,
    .employee-footer {
      margin-bottom: 8px;
      font-size: 8.5pt;
      line-height: 1.5;
    }
    .stats-line { margin: 0 0 2px; color: #444; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #e5e5e5;
      vertical-align: middle;
      text-align: right;
    }
    .summary-table { font-size: 8pt; }
    .summary-table th, .summary-table td { padding: 4px 6px; }
    .daily-table { font-size: 7pt; }
    .daily-table th, .daily-table td { padding: 2px 3px; }
    th { background: #f3f4f6; font-weight: 700; }
    tfoot td { background: #f9fafb; font-weight: 700; }
    .nowrap { white-space: nowrap; }
    .notes { word-wrap: break-word; font-size: 7pt; }
    .ltr { direction: ltr; text-align: center; font-family: monospace; }
    .name { font-weight: 600; }
    .red { color: #b91c1c; }
    .orange { color: #c2410c; }
    .teal { color: #0f766e; }
    .amber { color: #b45309; }
    .green { color: #15803d; }
    .violet { color: #6d28d9; font-weight: 600; }
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #aaa;
    }`;
}

export function attendanceReportFileName(
  companyName: string,
  branchName: string,
  month: string,
): string {
  return reportFileName(companyName, branchName, month);
}

export function buildAttendanceReportHtml(
  payload: AttendanceReportPayload,
): string {
  const summaryHtml = buildSummaryTableHtml(
    payload.summary.rows,
    payload.summary.totals,
  );

  const employeeSections = payload.employees
    .map(
      (employee) => `
      <div class="employee-section">
        <h3>${escapeHtml(employee.employeeName)} <span class="ltr">#${escapeHtml(employee.externalEmployeeNumber)}</span></h3>
        ${buildEmployeeHeaderStats(employee.payroll)}
        ${buildEmployeeDailyTableHtml(employee)}
        ${buildEmployeeFooterStats(employee.payroll)}
      </div>`,
    )
    .join("");

  const fileTitle = attendanceReportFileName(
    payload.meta.companyName,
    payload.meta.branchName,
    payload.meta.month,
  );

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(fileTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${pdfStyles()}</style>
</head>
<body>
  <div class="page-header">
    <div class="header-top">
      <div>
        <h1>${REPORT_LABELS.reportTitle}</h1>
        <p class="subtitle">${escapeHtml(payload.meta.companyName)} / ${escapeHtml(payload.meta.branchName)}</p>
        <p class="subtitle">${escapeHtml(payload.meta.monthLabel)}</p>
      </div>
      <div class="header-meta">
        <div>${REPORT_LABELS.printDate}</div>
        <div>${escapeHtml(payload.meta.printDate)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${REPORT_LABELS.branchSummary}</h2>
    ${summaryHtml}
  </div>

  <div class="section details-section">
    <h2>${REPORT_LABELS.employeeDetails}</h2>
    ${payload.employees.length === 0 ? '<p style="color:#999;">لا توجد سجلات لهذا الشهر.</p>' : employeeSections}
  </div>

  <div class="footer">
    <span>MD Group — ${escapeHtml(payload.meta.branchName)}</span>
    <span>${escapeHtml(payload.meta.printDate)}</span>
  </div>
</body>
</html>`;
}
