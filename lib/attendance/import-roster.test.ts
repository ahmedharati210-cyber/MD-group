import { describe, expect, it } from "vitest";
import {
  newPeoplePreviewFromRoster,
  resolveRosterUpsertIdentity,
  rosterEntriesFromBlocks,
  unionRosterEntries,
} from "@/lib/attendance/import-roster";

describe("rosterEntriesFromBlocks", () => {
  it("includes people with no punches and skips empty IDs", () => {
    const existing = new Map<string, { id: string }>([["101", { id: "p1" }]]);
    const entries = rosterEntriesFromBlocks(
      [
        {
          externalEmployeeNumber: "101",
          employeeName: "صهيب",
          departmentHint: "دولشي",
        },
        {
          externalEmployeeNumber: "105",
          employeeName: "حميد",
          departmentHint: "دولشي",
        },
        { externalEmployeeNumber: "  ", employeeName: "بدون رقم" },
        { externalEmployeeNumber: "104", employeeName: "  ", departmentHint: null },
      ],
      existing,
    );

    expect(entries).toEqual([
      {
        externalEmployeeNumber: "101",
        employeeName: "صهيب",
        departmentHint: "دولشي",
        isNewPerson: false,
      },
      {
        externalEmployeeNumber: "105",
        employeeName: "حميد",
        departmentHint: "دولشي",
        isNewPerson: true,
      },
      {
        externalEmployeeNumber: "104",
        employeeName: "موظف 104",
        departmentHint: null,
        isNewPerson: true,
      },
    ]);
  });
});

describe("unionRosterEntries", () => {
  it("keeps roster-only IDs and adds row-only IDs", () => {
    const merged = unionRosterEntries(
      [
        {
          externalEmployeeNumber: "105",
          employeeName: "حميد",
          departmentHint: null,
          isNewPerson: true,
        },
      ],
      [
        {
          externalEmployeeNumber: "101",
          employeeName: "صهيب",
          departmentHint: "دولشي",
          isNewPerson: false,
        },
        {
          externalEmployeeNumber: "105",
          employeeName: "should not replace",
          departmentHint: null,
          isNewPerson: true,
        },
      ],
    );

    expect(merged.map((e) => e.externalEmployeeNumber)).toEqual(["105", "101"]);
    expect(merged[0].employeeName).toBe("حميد");
  });
});

describe("newPeoplePreviewFromRoster", () => {
  it("lists only new fingerprint IDs", () => {
    expect(
      newPeoplePreviewFromRoster([
        {
          externalEmployeeNumber: "101",
          employeeName: "صهيب",
          departmentHint: null,
          isNewPerson: false,
        },
        {
          externalEmployeeNumber: "105",
          employeeName: "حميد",
          departmentHint: null,
          isNewPerson: true,
        },
      ]),
    ).toEqual([{ externalNumber: "105", name: "حميد" }]);
  });
});

describe("resolveRosterUpsertIdentity", () => {
  it("uses the file name and activates new people", () => {
    expect(resolveRosterUpsertIdentity("حميد", undefined)).toEqual({
      full_name: "حميد",
      active: true,
    });
  });

  it("keeps a deactivated person's name and active flag", () => {
    expect(
      resolveRosterUpsertIdentity("Name From File", {
        full_name: "الاسم المصحح",
        active: false,
      }),
    ).toEqual({
      full_name: "الاسم المصحح",
      active: false,
    });
  });

  it("fills an empty stored name from the file without reactivating", () => {
    expect(
      resolveRosterUpsertIdentity("حميد", {
        full_name: "  ",
        active: false,
      }),
    ).toEqual({
      full_name: "حميد",
      active: false,
    });
  });
});
