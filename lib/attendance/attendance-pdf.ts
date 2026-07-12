import "server-only";

import {
  buildBranchPayrollSummary,
  type PersonPayrollSummary,
} from "@/lib/attendance/attendance-view";
import { formatAttendanceRecordNotes } from "@/lib/attendance/leave-types";
import {
  enumerateMonthDays,
  formatMinutesAsHours,
  parseMonthParam,
} from "@/lib/attendance/monthly-calculations";
import { escapeHtml } from "@/lib/pdf/render-html-to-pdf";
import type {
  AttendanceBranch,
  AttendanceMonthlyRecord,
  AttendancePerson,
} from "@/types/db";

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

function shortDate(isoDate: string): string {
  return isoDate.slice(5);
}

function timeOrEmpty(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function hours(minutes: number): string {
  return formatMinutesAsHours(minutes);
}

function monthLabel(month: string): string {
  const parsed = parseMonthParam(month.slice(0, 7));
  if (!parsed) return month;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return date.toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    timeZone: "Africa/Tripoli",
  });
}

type EmployeeGroup = {
  externalEmployeeNumber: string;
  employeeName: string;
  recordsByDate: Map<string, AttendanceMonthlyRecord>;
};

function groupRecords(records: AttendanceMonthlyRecord[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
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

function recordNotes(rec: AttendanceMonthlyRecord): string {
  return formatAttendanceRecordNotes(rec);
}

function buildSummaryTableHtml(
  rows: ReturnType<typeof buildBranchPayrollSummary>["rows"],
  totals: ReturnType<typeof buildBranchPayrollSummary>["totals"],
): string {
  const header = `
    <thead>
      <tr>
        <th>الموظف</th>
        <th>#</th>
        <th>حضور</th>
        <th>غياب</th>
        <th>بصمة واحدة</th>
        <th>إجازات</th>
        <th>تأخير</th>
        <th>إضافي</th>
        <th>ساعات العمل</th>
        <th>المطلوب</th>
        <th>الخصم</th>
      </tr>
    </thead>`;

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td class="name">${escapeHtml(row.employeeName)}</td>
        <td class="ltr">${escapeHtml(row.externalEmployeeNumber)}</td>
        <td>${row.presentDays}</td>
        <td class="red">${row.absentDays}</td>
        <td class="orange">${row.onePunchDays}</td>
        <td class="teal">${row.leaveDays}</td>
        <td class="amber">${row.lateDays}</td>
        <td class="green">${row.overtimeDays}</td>
        <td class="ltr">${hours(row.totalWorkedMinutes)}</td>
        <td class="ltr">${hours(row.totalExpectedMinutes)}</td>
        <td class="ltr violet">${hours(row.totalDeductionMinutes)}</td>
      </tr>`,
    )
    .join("");

  const footer = `
    <tfoot>
      <tr>
        <td colspan="2">الإجمالي</td>
        <td>${totals.presentDays}</td>
        <td>${totals.absentDays}</td>
        <td>${totals.onePunchDays}</td>
        <td>${totals.leaveDays}</td>
        <td>${totals.lateDays}</td>
        <td>${totals.overtimeDays}</td>
        <td class="ltr">${hours(totals.totalWorkedMinutes)}</td>
        <td class="ltr">${hours(totals.totalExpectedMinutes)}</td>
        <td class="ltr violet">${hours(totals.totalDeductionMinutes)}</td>
      </tr>
    </tfoot>`;

  return `<table class="summary-table">${header}<tbody>${bodyRows}</tbody>${footer}</table>`;
}

function buildEmployeeHeaderStats(row: PersonPayrollSummary): string {
  return `
    <div class="employee-stats">
      <p class="stats-line">
        حضور: <strong>${row.presentDays}</strong>
        · غياب: <strong class="red">${row.absentDays}</strong>
        · بصمة واحدة: <strong class="orange">${row.onePunchDays}</strong>
        · إجازات: <strong class="teal">${row.leaveDays}</strong>
        · تأخير: <strong class="amber">${row.lateDays}</strong>
        · خروج مبكر: <strong>${row.earlyLeaveDays}</strong>
        · إضافي: <strong class="green">${row.overtimeDays}</strong>
      </p>
      <p class="stats-line">
        ساعات العمل: <strong class="ltr">${hours(row.totalWorkedMinutes)}</strong>
        · المطلوب: <strong class="ltr">${hours(row.totalExpectedMinutes)}</strong>
        · إجمالي الخصم: <strong class="ltr violet">${hours(row.totalDeductionMinutes)}</strong>
      </p>
    </div>`;
}

function buildEmployeeDailyTableHtml(
  group: EmployeeGroup,
  monthDays: string[],
): string {
  const rows = monthDays
    .map((date, index) => {
      const rec = group.recordsByDate.get(date);
      if (!rec) {
        return `
        <tr>
          <td class="nowrap">${index + 1}</td>
          <td class="ltr nowrap">${escapeHtml(shortDate(date))}</td>
          <td class="nowrap">${escapeHtml(dayNameAr(date))}</td>
          <td class="nowrap" colspan="7"></td>
        </tr>`;
      }

      return `
      <tr>
        <td class="nowrap">${index + 1}</td>
        <td class="ltr nowrap">${escapeHtml(shortDate(date))}</td>
        <td class="nowrap">${escapeHtml(dayNameAr(date))}</td>
        <td class="ltr nowrap">${escapeHtml(timeOrEmpty(rec.first_check_in))}</td>
        <td class="ltr nowrap">${escapeHtml(timeOrEmpty(rec.last_check_out))}</td>
        <td class="ltr nowrap">${rec.total_minutes != null ? hours(rec.total_minutes) : ""}</td>
        <td class="nowrap">${escapeHtml(rec.shift_type ?? "")}</td>
        <td class="nowrap">${rec.late_minutes || ""}</td>
        <td class="nowrap">${rec.early_leave_minutes || ""}</td>
        <td class="notes">${escapeHtml(recordNotes(rec))}</td>
      </tr>`;
    })
    .join("");

  return `
    <table class="daily-table">
      <colgroup>
        <col style="width:4%">
        <col style="width:6%">
        <col style="width:9%">
        <col style="width:8%">
        <col style="width:8%">
        <col style="width:8%">
        <col style="width:11%">
        <col style="width:7%">
        <col style="width:8%">
        <col style="width:31%">
      </colgroup>
      <thead>
        <tr>
          <th>م</th>
          <th>التاريخ</th>
          <th>اليوم</th>
          <th>دخول</th>
          <th>خروج</th>
          <th>الإجمالي</th>
          <th>الدوام</th>
          <th>تأخير</th>
          <th>خروج مبكر</th>
          <th>ملاحظات</th>
        </tr>
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
    .employee-stats {
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
    .daily-table { font-size: 8pt; }
    .daily-table th, .daily-table td { padding: 2px 4px; }
    th { background: #f3f4f6; font-weight: 700; }
    tfoot td { background: #f9fafb; font-weight: 700; }
    .nowrap { white-space: nowrap; }
    .notes { word-wrap: break-word; font-size: 7.5pt; }
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
  const [y, m] = month.slice(0, 7).split("-");
  return `تقرير الحضور - ${companyName} ${branchName} - ${m}-${y}`;
}

export function buildAttendanceReportHtml(options: {
  companyName: string;
  branch: AttendanceBranch;
  month: string;
  records: AttendanceMonthlyRecord[];
  people: AttendancePerson[];
}): string {
  const parsed = parseMonthParam(options.month.slice(0, 7));
  if (!parsed) throw new Error("شهر غير صالح");

  const monthDays = enumerateMonthDays(parsed.year, parsed.month);
  const monthStr = options.month.slice(0, 7);
  const { rows, totals } = buildBranchPayrollSummary(
    monthStr,
    options.records,
    options.people,
  );
  const groups = groupRecords(options.records);
  const rowByEmployee = new Map(
    rows.map((row) => [row.externalEmployeeNumber, row]),
  );

  const printDate = new Date().toLocaleDateString("ar-LY", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Tripoli",
  });

  const summaryHtml = buildSummaryTableHtml(rows, totals);

  const employeeSections = groups
    .map((group) => {
      const row = rowByEmployee.get(group.externalEmployeeNumber);
      const statsHtml = row
        ? buildEmployeeHeaderStats(row)
        : '<p class="stats-line" style="color:#999;">لا توجد بيانات ملخص</p>';
      return `
      <div class="employee-section">
        <h3>${escapeHtml(group.employeeName)} <span class="ltr">#${escapeHtml(group.externalEmployeeNumber)}</span></h3>
        ${statsHtml}
        ${buildEmployeeDailyTableHtml(group, monthDays)}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(attendanceReportFileName(options.companyName, options.branch.name, options.month))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${pdfStyles()}</style>
</head>
<body>
  <div class="page-header">
    <div class="header-top">
      <div>
        <h1>تقرير الحضور الشهري</h1>
        <p class="subtitle">${escapeHtml(options.companyName)} / ${escapeHtml(options.branch.name)}</p>
        <p class="subtitle">${escapeHtml(monthLabel(options.month))}</p>
      </div>
      <div class="header-meta">
        <div>تاريخ التقرير</div>
        <div>${escapeHtml(printDate)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>ملخص الفرع</h2>
    ${summaryHtml}
  </div>

  <div class="section details-section">
    <h2>تفاصيل الموظفين</h2>
    ${groups.length === 0 ? '<p style="color:#999;">لا توجد سجلات لهذا الشهر.</p>' : employeeSections}
  </div>

  <div class="footer">
    <span>MD Group — ${escapeHtml(options.branch.name)}</span>
    <span>${escapeHtml(printDate)}</span>
  </div>
</body>
</html>`;
}
