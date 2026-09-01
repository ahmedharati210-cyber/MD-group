import { describe, expect, it } from "vitest";
import { detectFormatFromSheetText } from "@/lib/attendance/attendance-format";
import {
  parseHikvisionMonthGridMatrix,
  parseTimesFromDayCell,
} from "@/lib/attendance/hikvision-month-grid-parser";
import { buildSessionsFromPunches } from "@/lib/attendance/punch-sessions";

describe("detectFormatFromSheetText", () => {
  it("detects Hikvision Attendance Record markers", () => {
    const joined =
      "Attendance Record Create Time:2026/08/01 Made Date:2026/07/01-2026/07/31 Employee ID Name Department 1 2 3";
    expect(detectFormatFromSheetText(joined)).toBe("hikvision_month_grid");
  });

  it("prefers Arabic per-day format over English-looking noise", () => {
    const joined =
      "رقم الموظف أول تسجيل دخول أخر تسجيل خروج التاريخ Employee ID";
    expect(detectFormatFromSheetText(joined)).toBe("per_day");
  });
});

describe("parseTimesFromDayCell", () => {
  it("splits newline-separated punch times", () => {
    expect(parseTimesFromDayCell("16:12\n23:15\n")).toEqual(["16:12", "23:15"]);
  });

  it("handles single punch and pads hours", () => {
    expect(parseTimesFromDayCell("9:05")).toEqual(["09:05"]);
  });
});

describe("parseHikvisionMonthGridMatrix", () => {
  const matrix: string[][] = [
    ["Attendance Record"],
    [],
    ["Create Time:2026/08/01 16:08:09"],
    ["Made Date:2026/07/01-2026/07/31"],
    [
      "Employee ID",
      "Name",
      "Department",
      "1",
      "2",
      "3",
      ...Array.from({ length: 28 }, (_, i) => String(i + 4)),
    ],
    [],
    ["1", "Harati", "Company", ...Array(31).fill("")],
    [
      "101",
      "صهيب الدقروني",
      "دولشي النوفليين",
      "14:04\n",
      "16:12\n23:15\n",
      "18:39\n",
      ...Array(28).fill(""),
    ],
    ["104", "مالك", "دولشي النوفليين", ...Array(31).fill("")],
    ["2", "", "Company", ...Array(31).fill("")],
  ];

  it("imports Company-department rows that have punches, skips empty group headers", () => {
    const dayCells = Array.from({ length: 31 }, () => "");
    dayCells[4] = "14:15\n23:05\n";
    dayCells[5] = "08:00\n17:00\n";
    const dayCells098 = Array.from({ length: 31 }, () => "");
    dayCells098[8] = "16:00\n";

    const parsed = parseHikvisionMonthGridMatrix([
      ...matrix,
      ["Cafe", "محمد ميلاد", "Company", ...dayCells],
      ["098", "مالك بن جابر", "Company", ...dayCells098],
    ]);

    expect(parsed.blocks.find((b) => b.externalEmployeeNumber === "1")).toBeUndefined();
    expect(parsed.blocks.find((b) => b.externalEmployeeNumber === "2")).toBeUndefined();

    const milad = parsed.blocks.find((b) => b.externalEmployeeNumber === "Cafe");
    expect(milad?.employeeName).toBe("محمد ميلاد");
    expect(milad?.punches).toEqual(
      expect.arrayContaining([
        { date: "2026-07-05", time: "14:15" },
        { date: "2026-07-05", time: "23:05" },
        { date: "2026-07-06", time: "08:00" },
        { date: "2026-07-06", time: "17:00" },
      ]),
    );

    const malekJaber = parsed.blocks.find(
      (b) => b.externalEmployeeNumber === "098",
    );
    expect(malekJaber?.employeeName).toBe("مالك بن جابر");
    expect(malekJaber?.punches).toEqual([
      { date: "2026-07-09", time: "16:00" },
    ]);
  });

  it("skips Company separator rows and expands day cells into punches", () => {
    const parsed = parseHikvisionMonthGridMatrix(matrix);
    expect(parsed.periodStart).toBe("2026-07-01");
    expect(parsed.periodEnd).toBe("2026-07-31");
    expect(parsed.blocks).toHaveLength(2);

    const sohaib = parsed.blocks.find((b) => b.externalEmployeeNumber === "101");
    expect(sohaib?.employeeName).toBe("صهيب الدقروني");
    expect(sohaib?.punches).toEqual(
      expect.arrayContaining([
        { date: "2026-07-01", time: "14:04" },
        { date: "2026-07-02", time: "16:12" },
        { date: "2026-07-02", time: "23:15" },
        { date: "2026-07-03", time: "18:39" },
      ]),
    );

    const malek = parsed.blocks.find((b) => b.externalEmployeeNumber === "104");
    expect(malek?.punches).toHaveLength(0);
    expect(parsed.warnings.some((w) => w.includes("104"))).toBe(true);
  });

  it("builds one session with check-in/out for a two-punch day", () => {
    const parsed = parseHikvisionMonthGridMatrix(matrix);
    const sohaib = parsed.blocks.find((b) => b.externalEmployeeNumber === "101")!;
    const day2Punches = sohaib.punches.filter((p) => p.date === "2026-07-02");
    const { sessions } = buildSessionsFromPunches(day2Punches);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].firstCheckIn).toBe("16:12");
    expect(sessions[0].lastCheckOut).toBe("23:15");
    expect(sessions[0].punchCount).toBe(2);
  });

  it("keeps single-punch days as one-punch sessions", () => {
    const parsed = parseHikvisionMonthGridMatrix(matrix);
    const sohaib = parsed.blocks.find((b) => b.externalEmployeeNumber === "101")!;
    const day1Punches = sohaib.punches.filter((p) => p.date === "2026-07-01");
    const { sessions } = buildSessionsFromPunches(day1Punches);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].punchCount).toBe(1);
    expect(sessions[0].firstCheckIn).toBe("14:04");
    expect(sessions[0].lastCheckOut).toBe("14:04");
  });
});
