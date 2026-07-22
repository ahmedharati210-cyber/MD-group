import {
  buildPersonCalendarDays,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import { resolvePersonWorkDays } from "@/lib/attendance/person-schedule";
import {
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { AttendancePersonMonthTable } from "./attendance-person-month-table";
import { AttendancePersonSummaryCards } from "./attendance-summary-cards";

type Props = {
  companyId: string;
  branchId: string;
  personId: string;
  month: string;
  monthDate: string;
  isSuperAdmin: boolean;
};

export async function AttendancePersonDetailSection({
  companyId,
  branchId,
  personId,
  month,
  monthDate,
  isSuperAdmin,
}: Props) {
  const [importRow, people, branchShifts] = await Promise.all([
    getAttendanceImport(companyId, branchId, monthDate),
    getAttendancePeople(companyId, branchId),
    getAttendanceShifts(branchId),
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
  const calendarDays = buildPersonCalendarDays(month, personRecords, workDays);
  const personStats = buildPersonMonthStats(month, personRecords, workDays);

  if (!importRow) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        لا يوجد استيراد لهذا الشهر. قم باستيراد ملف البصمة من صفحة الفرع أولاً.
      </p>
    );
  }

  return (
    <>
      <AttendancePersonSummaryCards
        stats={personStats}
        month={month}
        records={personRecords}
        employeeName={person.full_name}
        workDays={workDays}
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
