import Link from "next/link";
import { ArrowRight, Download, FileText } from "lucide-react";
import { requireAttendanceAccess } from "@/lib/auth";
import { buildBranchPayrollSummary } from "@/lib/attendance/attendance-view";
import { getDefaultAttendanceMonth } from "@/lib/attendance/import-month";
import {
  attendanceShowCompanyPicker,
  resolveAttendanceBranchId,
  resolveAttendanceCompanyId,
} from "@/lib/attendance/scope";
import {
  getAttendanceBranches,
  getAttendanceCompanies,
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { PageHeader } from "@/components/portal/PageHeader";
import { MonthlyFilters } from "../monthly-filters";
import { AttendanceExportActions } from "../attendance-export-actions";
import { AttendancePayrollSummary } from "../attendance-payroll-summary";
import { buildBranchAttendanceHref } from "../attendance-navigation";

export const metadata = { title: "ملخص الحضور والخصومات" };

type SearchParams = Promise<{
  companyId?: string;
  branchId?: string;
  month?: string;
}>;

export default async function AttendanceSummaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireAttendanceAccess();
  const params = await searchParams;

  const defaultMonth = getDefaultAttendanceMonth();
  const month = params.month ?? defaultMonth;

  const companies = await getAttendanceCompanies({
    attendanceEnabledOnly: profile.role === "md_admin" && !profile.is_super_admin,
  });
  const companyId = await resolveAttendanceCompanyId(
    profile,
    params.companyId,
    companies,
  );

  const branches = companyId ? await getAttendanceBranches(companyId) : [];
  const branchId = resolveAttendanceBranchId(params.branchId, branches);
  const monthDate = `${month}-01`;

  const [importRow, people, branchShifts] = await Promise.all([
    companyId && branchId
      ? getAttendanceImport(companyId, branchId, monthDate)
      : Promise.resolve(null),
    companyId && branchId
      ? getAttendancePeople(companyId, branchId)
      : Promise.resolve([]),
    branchId ? getAttendanceShifts(branchId) : Promise.resolve([]),
  ]);

  const records = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  const { rows, totals } = buildBranchPayrollSummary(
    month,
    records,
    people,
    branchShifts,
  );
  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const canExport = Boolean(companyId && branchId && importRow);
  const showExportHint = Boolean(companyId && branchId && !importRow);
  const hasData = records.length > 0;
  const exportHref =
    companyId && branchId
      ? `/api/attendance/export.xlsx?companyId=${companyId}&branchId=${branchId}&month=${month}`
      : "#";
  const exportPdfHref =
    companyId && branchId
      ? `/api/attendance/export.pdf?companyId=${companyId}&branchId=${branchId}&month=${month}`
      : "#";

  return (
    <div>
      <Link
        href={
          companyId && branchId
            ? buildBranchAttendanceHref({ companyId, branchId, month })
            : companyId
              ? `/portal/attendance?companyId=${companyId}&month=${month}`
              : "/portal/attendance"
        }
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الحضور
      </Link>

      <PageHeader
        title="ملخص الحضور والخصومات"
        description={
          selectedBranch
            ? `تقرير شهري لفرع ${selectedBranch.name} — ساعات العمل والخصومات لكل موظف.`
            : "تقرير شهري لساعات العمل والخصومات."
        }
        action={
          canExport ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={exportPdfHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
              >
                <FileText className="w-4 h-4" />
                تصدير PDF
              </Link>
              <Link
                href={exportHref}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm"
              >
                <Download className="w-4 h-4" />
                تصدير Excel
              </Link>
            </div>
          ) : null
        }
      />

      <MonthlyFilters
        companies={companies}
        branches={branches}
        companyId={companyId}
        branchId={branchId}
        month={month}
        showCompanyPicker={attendanceShowCompanyPicker(profile)}
        basePath="/portal/attendance/summary"
      />

      {companyId && branchId ? (
        <AttendanceExportActions
          pdfHref={exportPdfHref}
          excelHref={exportHref}
          canExport={canExport}
          showHint={showExportHint}
        />
      ) : null}

      {!companyId ? (
        <p className="text-sm text-gray-500">اختر شركة لعرض الملخص.</p>
      ) : !branchId ? (
        <p className="text-sm text-gray-500">اختر فرعاً لعرض الملخص.</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          لا توجد سجلات محفوظة لهذا الشهر. قم باستيراد ملف البصمة أولاً.
        </p>
      ) : (
        <AttendancePayrollSummary rows={rows} totals={totals} />
      )}
    </div>
  );
}
