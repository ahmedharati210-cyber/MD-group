import { describe, expect, it } from "vitest";
import { matchPunchLogToAttendancePeople } from "@/lib/attendance/punch-log-import";
import { DEFAULT_FULL_TIME_CONFIG } from "@/lib/attendance/shift-matching";
import type { RawPunchBlock } from "@/lib/attendance/raw-punch-log-parser";

describe("matchPunchLogToAttendancePeople roster", () => {
  it("returns 0-punch people in rosterEntries without day rows", async () => {
    const blocks: RawPunchBlock[] = [
      {
        externalEmployeeNumber: "101",
        employeeName: "صهيب",
        departmentHint: "دولشي",
        punches: [{ date: "2026-08-01", time: "14:04" }],
      },
      {
        externalEmployeeNumber: "105",
        employeeName: "حميد",
        departmentHint: "دولشي",
        punches: [],
      },
    ];

    const matched = await matchPunchLogToAttendancePeople(
      blocks,
      new Map(),
      [],
      DEFAULT_FULL_TIME_CONFIG,
    );

    expect(matched.rows.map((r) => r.externalEmployeeNumber)).toEqual(["101"]);
    expect(matched.rosterEntries.map((e) => e.externalEmployeeNumber)).toEqual([
      "101",
      "105",
    ]);
    expect(matched.rosterEntries.every((e) => e.isNewPerson)).toBe(true);
  });
});
