import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireAttendanceAccess } from "@/lib/auth";
import {
  buildCalendarDays,
  buildDayRosterEntries,
  buildMonthSummary,
  buildPersonCalendarDays,
  buildPersonMonthStats,
  personRecordCounts,
} from "@/lib/attendance/attendance-view";
import { getDefaultAttendanceMonth } from "@/lib/attendance/import-month";
import {
  filterPeopleBySearch,
  filterRecordsBySearch,
  normalizeSearchQuery,
} from "@/lib/attendance/search";
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
import { AttendanceCalendar } from "./attendance-calendar";
import { AttendanceDayPanel } from "./attendance-day-panel";
import { AttendanceImportForm } from "./attendance-import-form";
import { AttendancePersonHeader } from "./attendance-person-detail";
import { AttendancePersonList } from "./attendance-person-list";
import { AttendanceSearch } from "./attendance-search";
import {
  AttendancePersonSummaryCards,
  AttendanceSummaryCards,
} from "./attendance-summary-cards";
import { buildBranchAttendanceHref } from "./attendance-navigation";
import { AttendanceExportActions } from "./attendance-export-actions";
import { AttendanceToolbar } from "./attendance-toolbar";
import { MonthlyFilters } from "./monthly-filters";

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

  const allRecords = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  const filteredRecords = filterRecordsBySearch(allRecords, searchQuery);
  const filteredPeople = filterPeopleBySearch(people, searchQuery);
  const hasSearch = searchQuery.length > 0;
  const counts = personRecordCounts(people, allRecords);

  const peopleWithCounts = filteredPeople.map((p) => ({
    ...p,
    recordCount: counts.get(p.id) ?? 0,
  }));

  const selectedDay = params.day ?? null;
  const selectedPersonId = params.personId ?? null;
  const selectedPerson = selectedPersonId
    ? (people.find((p) => p.id === selectedPersonId) ?? null)
    : null;

  const personAllRecords = selectedPerson
    ? allRecords.filter((r) => r.attendance_person_id === selectedPerson.id)
    : [];

  const calendarDays = selectedPerson
    ? buildPersonCalendarDays(month, personAllRecords)
    : buildCalendarDays(
        month,
        filteredRecords,
        hasSearch ? filteredPeople : people,
      );

  const summary = buildMonthSummary(
    month,
    hasSearch ? filteredRecords : allRecords,
    hasSearch ? filteredPeople : people,
  );
  const personStats = selectedPerson
    ? buildPersonMonthStats(month, personAllRecords)
    : null;

  const navContext =
    companyId && branchId
      ? { companyId, branchId, month }
      : null;

  const rosterPeople = selectedPerson
    ? [selectedPerson]
    : hasSearch
      ? filteredPeople
      : people;

  const dayRosterEntries =
    selectedDay && companyId && branchId
      ? buildDayRosterEntries(
          selectedDay,
          hasSearch ? filteredRecords : allRecords,
          rosterPeople,
        )
      : [];

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
  const noSearchResults =
    hasSearch && allRecords.length > 0 && filteredRecords.length === 0 && filteredPeople.length === 0;
  const hasData = allRecords.length > 0;

  return (
    <div>
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
          <AttendanceSearch basePath="/portal/attendance" defaultValue={params.q ?? ""} />

          {noSearchResults ? (
            <p className="text-sm text-gray-500 mb-4">
              لا توجد نتائج للبحث «{params.q}». جرّب اسماً آخر أو{" "}
              <Link
                href={`/portal/attendance?companyId=${companyId}&branchId=${branchId}&month=${month}`}
                className="text-primary-600 underline"
              >
                امسح البحث
              </Link>
              .
            </p>
          ) : null}

          {selectedPerson && personStats && importRow ? (
            <>
              <AttendancePersonHeader
                personName={selectedPerson.full_name}
                externalNumber={selectedPerson.external_employee_number}
                recordCount={personAllRecords.length}
                leaveDays={personStats.leaveDays}
                closeHref={
                  navContext ? buildBranchAttendanceHref(navContext) : null
                }
              />
              <AttendancePersonSummaryCards stats={personStats} />
            </>
          ) : (
            <AttendanceSummaryCards summary={summary} />
          )}

          <AttendanceToolbar
            importRow={importRow}
            isSuperAdmin={profile.is_super_admin}
          />

          <div className="mb-4">
            <AttendanceImportForm
              companyId={companyId}
              branchId={branchId}
              month={month}
            />
          </div>

          {!hasData ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              لا توجد سجلات محفوظة لهذا الشهر. قم باستيراد ملف البصمة أولاً.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <AttendanceCalendar
                  days={calendarDays}
                  month={month}
                  selectedDay={selectedDay}
                  personMode={Boolean(selectedPerson)}
                  title={
                    selectedPerson ? `تقويم ${selectedPerson.full_name}` : "تقويم الشهر"
                  }
                />
                {selectedDay ? (
                  <AttendanceDayPanel
                    date={selectedDay}
                    entries={dayRosterEntries}
                    shifts={branchShifts}
                    isSuperAdmin={profile.is_super_admin}
                    hasSearch={hasSearch}
                    companyId={companyId}
                    branchId={branchId}
                  />
                ) : null}
              </div>
              <AttendancePersonList
                people={peopleWithCounts}
                selectedPersonId={selectedPersonId}
                hasSearch={hasSearch}
                navContext={{
                  companyId: companyId!,
                  branchId: branchId!,
                  month,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
