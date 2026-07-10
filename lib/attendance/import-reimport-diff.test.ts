import { describe, expect, it } from "vitest";
import { computeImportReimportDiff } from "@/lib/attendance/import-reimport-diff";
import type { MatchedImportRow } from "@/lib/attendance/raw-excel-parser";

function importRow(
  externalEmployeeNumber: string,
  date: string,
  firstCheckIn: string | null,
  lastCheckOut: string | null,
): MatchedImportRow {
  return {
    externalEmployeeNumber,
    employeeName: "Test",
    departmentHint: null,
    attendancePersonId: null,
    isNewPerson: false,
    date,
    dayName: "",
    totalTime: null,
    firstCheckIn,
    lastCheckOut,
    computed: {
      shiftType: null,
      expectedMinutes: null,
      totalMinutes: null,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deductionMinutes: 0,
      isAbsent: false,
      notes: null,
    },
    totalMinutes: null,
  };
}

describe("computeImportReimportDiff", () => {
  it("counts new, removed, changed, and unchanged rows", () => {
    const existing = [
      {
        external_employee_number: "1",
        date: "2026-06-01",
        first_check_in: "09:00:00",
        last_check_out: "17:00:00",
        manually_overridden: false,
      },
      {
        external_employee_number: "1",
        date: "2026-06-02",
        first_check_in: "09:00:00",
        last_check_out: "17:00:00",
        manually_overridden: true,
      },
    ];
    const incoming = [
      importRow("1", "2026-06-01", "09:00", "17:00"),
      importRow("1", "2026-06-02", "09:15", "17:00"),
      importRow("1", "2026-06-03", "09:00", "17:00"),
    ];

    const diff = computeImportReimportDiff(existing, incoming);
    expect(diff.unchanged).toBe(1);
    expect(diff.changedPunches).toBe(1);
    expect(diff.manuallyEditedAtRisk).toBe(1);
    expect(diff.newDays).toBe(1);
    expect(diff.removedDays).toBe(0);
  });
});
