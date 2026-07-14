import {
  personRecordCounts,
} from "@/lib/attendance/attendance-view";
import {
  filterPeopleBySearch,
  filterRecordsBySearch,
} from "@/lib/attendance/search";
import {
  getAttendanceImport,
  getAttendancePeople,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { AttendancePersonList } from "./attendance-person-list";

type Props = {
  companyId: string;
  branchId: string;
  month: string;
  monthDate: string;
  personId: string | null;
  searchQuery: string;
};

export async function AttendancePersonListSection({
  companyId,
  branchId,
  month,
  monthDate,
  personId,
  searchQuery,
}: Props) {
  const [importRow, people] = await Promise.all([
    getAttendanceImport(companyId, branchId, monthDate),
    getAttendancePeople(companyId, branchId),
  ]);

  const allRecords = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  if (allRecords.length === 0) {
    return null;
  }

  const filteredRecords = filterRecordsBySearch(allRecords, searchQuery);
  const filteredPeople = filterPeopleBySearch(people, searchQuery);
  const hasSearch = searchQuery.length > 0;
  const counts = personRecordCounts(people, allRecords);

  const peopleWithCounts = filteredPeople.map((p) => ({
    ...p,
    recordCount: counts.get(p.id) ?? 0,
  }));

  if (
    hasSearch &&
    allRecords.length > 0 &&
    filteredRecords.length === 0 &&
    filteredPeople.length === 0
  ) {
    return null;
  }

  return (
    <AttendancePersonList
      people={peopleWithCounts}
      selectedPersonId={personId}
      hasSearch={hasSearch}
      navContext={{
        companyId,
        branchId,
        month,
      }}
    />
  );
}
