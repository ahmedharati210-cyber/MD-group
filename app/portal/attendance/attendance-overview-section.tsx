import Link from "next/link";
import {
  buildCalendarDays,
  buildDayRosterEntries,
  buildMonthSummary,
  buildPersonCalendarDays,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import { resolvePersonWorkDays } from "@/lib/attendance/person-schedule";
import {
  filterPeopleBySearch,
  filterRecordsBySearch,
  normalizeSearchQuery,
} from "@/lib/attendance/search";
import {
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getCompanyAttendanceMonthStartDay,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { AttendanceCalendar } from "./attendance-calendar";
import { AttendanceDayPanel } from "./attendance-day-panel";
import { AttendancePersonHeader } from "./attendance-person-detail";
import {
  AttendancePersonSummaryCards,
  AttendanceSummaryCards,
} from "./attendance-summary-cards";
import { buildBranchAttendanceHref } from "./attendance-navigation";

type Props = {
  companyId: string;
  branchId: string;
  month: string;
  monthDate: string;
  day: string | null;
  personId: string | null;
  searchQuery: string;
  isSuperAdmin: boolean;
  canResetLeaveBalance?: boolean;
};

export async function AttendanceOverviewSection({
  companyId,
  branchId,
  month,
  monthDate,
  day,
  personId,
  searchQuery,
  isSuperAdmin,
  canResetLeaveBalance = false,
}: Props) {
  const [importRow, people, branchShifts, monthStartDay] = await Promise.all([
    getAttendanceImport(companyId, branchId, monthDate),
    getAttendancePeople(companyId, branchId),
    getAttendanceShifts(branchId),
    getCompanyAttendanceMonthStartDay(companyId),
  ]);

  const allRecords = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  const filteredRecords = filterRecordsBySearch(allRecords, searchQuery);
  const filteredPeople = filterPeopleBySearch(people, searchQuery);
  const hasSearch = searchQuery.length > 0;

  const selectedPerson = personId
    ? (people.find((p) => p.id === personId) ?? null)
    : null;

  const personAllRecords = selectedPerson
    ? allRecords.filter((r) => r.attendance_person_id === selectedPerson.id)
    : [];

  const selectedPersonWorkDays = selectedPerson
    ? resolvePersonWorkDays(selectedPerson, branchShifts)
    : null;

  const calendarDays = selectedPerson
    ? buildPersonCalendarDays(
        month,
        personAllRecords,
        selectedPersonWorkDays,
        monthStartDay,
      )
    : buildCalendarDays(
        month,
        filteredRecords,
        hasSearch ? filteredPeople : people,
        branchShifts,
        monthStartDay,
      );

  const summary = buildMonthSummary(
    month,
    hasSearch ? filteredRecords : allRecords,
    hasSearch ? filteredPeople : people,
    branchShifts,
    monthStartDay,
  );
  const personStats = selectedPerson
    ? buildPersonMonthStats(
        month,
        personAllRecords,
        selectedPersonWorkDays,
        monthStartDay,
      )
    : null;

  const navContext = { companyId, branchId, month };

  const rosterPeople = selectedPerson
    ? [selectedPerson]
    : hasSearch
      ? filteredPeople
      : people;

  const dayRosterEntries = day
    ? buildDayRosterEntries(
        day,
        hasSearch ? filteredRecords : allRecords,
        rosterPeople,
        branchShifts,
      )
    : [];

  const hasData = allRecords.length > 0;
  const noSearchResults =
    hasSearch &&
    allRecords.length > 0 &&
    filteredRecords.length === 0 &&
    filteredPeople.length === 0;

  if (noSearchResults) {
    return (
      <p className="text-sm text-gray-500 mb-4">
        لا توجد نتائج للبحث. جرّب اسماً آخر أو{" "}
        <Link
          href={`/portal/attendance?companyId=${companyId}&branchId=${branchId}&month=${month}`}
          className="text-primary-600 underline"
        >
          امسح البحث
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      {selectedPerson && personStats && importRow ? (
        <>
          <AttendancePersonHeader
            personName={selectedPerson.full_name}
            externalNumber={selectedPerson.external_employee_number}
            recordCount={personAllRecords.length}
            leaveDays={personStats.leaveDays}
            closeHref={buildBranchAttendanceHref(navContext)}
            person={selectedPerson}
            canResetLeaveBalance={canResetLeaveBalance}
          />
          <AttendancePersonSummaryCards
            stats={personStats}
            month={month}
            records={personAllRecords}
            employeeName={selectedPerson.full_name}
            workDays={selectedPersonWorkDays}
            monthStartDay={monthStartDay}
          />
        </>
      ) : (
        <AttendanceSummaryCards summary={summary} />
      )}

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          لا توجد سجلات محفوظة لهذا الشهر. قم باستيراد ملف البصمة أولاً.
        </p>
      ) : (
        <div className="space-y-4">
          <AttendanceCalendar
            days={calendarDays}
            month={month}
            selectedDay={day}
            personMode={Boolean(selectedPerson)}
            title={
              selectedPerson ? `تقويم ${selectedPerson.full_name}` : "تقويم الشهر"
            }
          />
          {day ? (
            <AttendanceDayPanel
              date={day}
              entries={dayRosterEntries}
              shifts={branchShifts}
              isSuperAdmin={isSuperAdmin}
              hasSearch={hasSearch}
              companyId={companyId}
              branchId={branchId}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
