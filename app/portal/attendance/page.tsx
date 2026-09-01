import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requireAttendanceAccess } from "@/lib/auth";
import { getDefaultAttendanceMonth } from "@/lib/attendance/import-month";
import { normalizeSearchQuery } from "@/lib/attendance/search";
import {
  attendanceShowCompanyPicker,
  resolveAttendanceBranchId,
  resolveAttendanceCompanyId,
} from "@/lib/attendance/scope";
import {
  getAttendanceBranches,
  getAttendanceCompanies,
  getAttendanceImport,
} from "@/lib/data/monthly-attendance";
import {
  isDateInAttendancePeriod,
  resolveAttendancePeriod,
} from "@/lib/attendance/attendance-period";
import { PageHeader } from "@/components/portal/PageHeader";
import { AttendanceImportForm } from "./attendance-import-form";
import { AttendanceSearch } from "./attendance-search";
import { AttendanceExportActions } from "./attendance-export-actions";
import { AttendanceToolbar } from "./attendance-toolbar";
import { MonthlyFilters } from "./monthly-filters";
import { AttendanceOverviewSection } from "./attendance-overview-section";
import { AttendancePersonListSection } from "./attendance-person-list-section";
import {
  AttendanceOverviewSkeleton,
  PersonListSkeleton,
} from "./attendance-section-skeletons";
import { buildBranchAttendanceHref } from "./attendance-navigation";
import { RestoreListFilters } from "@/components/portal/list-filters";
import { LIST_FILTER_KEYS } from "@/lib/portal-list-filters";

export const metadata = { title: "الحضور الشهري" };

type SearchParams = Promise<{
  companyId?: string;
  branchId?: string;
  month?: string;
  q?: string;
  day?: string;
  personId?: string;
}>;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireAttendanceAccess();
  const params = await searchParams;
  const searchQuery = normalizeSearchQuery(params.q);
  const selectedPersonId = params.personId ?? null;

  const companies = await getAttendanceCompanies({
    attendanceEnabledOnly: profile.role === "md_admin" && !profile.is_super_admin,
  });
  const companyId = await resolveAttendanceCompanyId(
    profile,
    params.companyId,
    companies,
  );

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const monthStartDay = selectedCompany?.attendance_month_start_day ?? 1;
  const defaultMonth = getDefaultAttendanceMonth(new Date(), monthStartDay);
  const month = params.month ?? defaultMonth;
  const monthDate = `${month}-01`;
  const period = resolveAttendancePeriod(month, monthStartDay);
  const rawSelectedDay = params.day ?? null;
  const selectedDay =
    rawSelectedDay &&
    period &&
    isDateInAttendancePeriod(rawSelectedDay, period)
      ? rawSelectedDay
      : null;

  const branches = companyId ? await getAttendanceBranches(companyId) : [];
  const branchId = resolveAttendanceBranchId(params.branchId, branches);

  const hasClientFilterParams = Boolean(
    params.companyId ||
      params.branchId ||
      params.month ||
      searchQuery ||
      rawSelectedDay ||
      selectedPersonId,
  );

  // Keep URL in sync with resolved company/branch/month so back links land correctly.
  // Skip when the URL is empty so the client can restore last-used filters.
  // Also drop invalid out-of-period ?day= values.
  if (
    hasClientFilterParams &&
    companyId &&
    branchId &&
    (params.companyId !== companyId ||
      params.branchId !== branchId ||
      params.month !== month ||
      (rawSelectedDay != null && selectedDay !== rawSelectedDay))
  ) {
    redirect(
      buildBranchAttendanceHref(
        { companyId, branchId, month },
        {
          day: selectedDay,
          personId: selectedPersonId,
          q: searchQuery || null,
        },
      ),
    );
  }

  const importRow =
    companyId && branchId
      ? await getAttendanceImport(companyId, branchId, monthDate)
      : null;

  const exportHref =
    companyId && branchId
      ? `/api/attendance/export.xlsx?companyId=${companyId}&branchId=${branchId}&month=${month}`
      : "#";
  const exportPdfHref =
    companyId && branchId
      ? `/api/attendance/export.pdf?companyId=${companyId}&branchId=${branchId}&month=${month}`
      : "#";

  const canExport = Boolean(companyId && branchId && importRow);
  const showExportHint = Boolean(companyId && branchId && !importRow);

  const periodLabel =
    monthStartDay !== 1 ? (period?.label ?? null) : null;

  const overviewKey = `${month}-${selectedDay ?? ""}-${selectedPersonId ?? ""}-${searchQuery}`;
  const listKey = `${month}-${searchQuery}`;

  return (
    <div>
      <RestoreListFilters
        path="/portal/attendance"
        keys={LIST_FILTER_KEYS.attendance}
        fallback={{
          ...(companyId ? { companyId } : {}),
          ...(branchId ? { branchId } : {}),
          ...(month ? { month } : {}),
        }}
      />
      <PageHeader
        title="الحضور الشهري"
        description="تقويم شهري، ملخص، واستيراد/تصدير الحضور."
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
        periodLabel={periodLabel}
      />

      {showExportHint ? (
        <AttendanceExportActions
          pdfHref={exportPdfHref}
          excelHref={exportHref}
          canExport={false}
          showHint
        />
      ) : null}

      {!companyId ? (
        <p className="text-sm text-gray-500">اختر شركة لعرض الحضور.</p>
      ) : branches.length === 0 ? (
        <p className="text-sm text-gray-500">
          لا توجد فروع بعد.{" "}
          <Link href="/portal/attendance/branches" className="text-primary-600 underline">
            أضف فروع الحضور
          </Link>
        </p>
      ) : !branchId ? (
        <p className="text-sm text-gray-500">اختر فرعاً لعرض الحضور.</p>
      ) : (
        <>
          <AttendanceSearch
            basePath="/portal/attendance"
            defaultValue={params.q ?? ""}
          />

          <AttendanceToolbar
            importRow={importRow}
            isSuperAdmin={profile.is_super_admin}
            companyId={companyId}
            branchId={branchId}
            month={month}
          />

          <div className="mb-4">
            <AttendanceImportForm
              companyId={companyId}
              branchId={branchId}
              month={month}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Suspense key={overviewKey} fallback={<AttendanceOverviewSkeleton />}>
                <AttendanceOverviewSection
                  companyId={companyId}
                  branchId={branchId}
                  month={month}
                  monthDate={monthDate}
                  day={selectedDay}
                  personId={selectedPersonId}
                  searchQuery={searchQuery}
                  isSuperAdmin={profile.is_super_admin}
                  canResetLeaveBalance={
                    profile.is_super_admin || profile.role === "md_admin"
                  }
                />
              </Suspense>
            </div>
            <Suspense key={listKey} fallback={<PersonListSkeleton />}>
              <AttendancePersonListSection
                companyId={companyId}
                branchId={branchId}
                month={month}
                monthDate={monthDate}
                personId={selectedPersonId}
                searchQuery={searchQuery}
              />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
