import {
  buildPersonCalendarDays,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import { resolvePersonWorkDays } from "@/lib/attendance/person-schedule";
import {
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getCompanyAttendanceMonthStartDay,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { AttendancePersonMonthTable } from "./attendance-person-month-table";
import { AttendancePersonSummaryCards } from "./attendance-summary-cards";
import { PersonLeaveBalanceBadges } from "./person-leave-balance";

type Props = {
  companyId: string;
  branchId: string;
  personId: string;
  month: string;
  monthDate: string;
  isSuperAdmin: boolean;
  canResetLeaveBalance?: boolean;
};

export async function AttendancePersonDetailSection({
  companyId,
  branchId,
  personId,
  month,
  monthDate,
  isSuperAdmin,
  canResetLeaveBalance = false,
}: Props) {
  const [importRow, people, branchShifts, monthStartDay] = await Promise.all([
    getAttendanceImport(companyId, branchId, monthDate),
    getAttendancePeople(companyId, branchId),
    getAttendanceShifts(branchId),
    getCompanyAttendanceMonthStartDay(companyId),
  ]);

  const person = people.find((p) => p.id === personId);
  if (!person) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">الموظف غير موجود.</p>
    );
  }

  const allRecords = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  const personRecords = allRecords.filter(
    (record) => record.attendance_person_id === person.id,
  );
  const workDays = resolvePersonWorkDays(person, branchShifts);
  const calendarDays = buildPersonCalendarDays(
    month,
    personRecords,
    workDays,
    monthStartDay,
  );
  const personStats = buildPersonMonthStats(
    month,
    personRecords,
    workDays,
    monthStartDay,
  );

  if (!importRow) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        لا يوجد استيراد لهذا الشهر. قم باستيراد ملف البصمة من صفحة الفرع أولاً.
      </p>
    );
  }

  return (
    <>
      <div className="mb-4">
        <PersonLeaveBalanceBadges
          person={person}
          personId={person.id}
          canReset={canResetLeaveBalance}
        />
      </div>
      <AttendancePersonSummaryCards
        stats={personStats}
        month={month}
        records={personRecords}
        employeeName={person.full_name}
        workDays={workDays}
        monthStartDay={monthStartDay}
        compact
      />
      <AttendancePersonMonthTable
        days={calendarDays}
        person={person}
        shifts={branchShifts}
        companyId={companyId}
        branchId={branchId}
        isSuperAdmin={isSuperAdmin}
      />
    </>
  );
}
