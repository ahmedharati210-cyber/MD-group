import { describe, expect, it } from "vitest";
import {
  detectDominantMonthFromDates,
  detectImportMonthMismatch,
  getDefaultAttendanceMonth,
} from "@/lib/attendance/import-month";

describe("getDefaultAttendanceMonth", () => {
  it("returns previous calendar month when start day is 1", () => {
    expect(getDefaultAttendanceMonth(new Date(2026, 6, 24), 1)).toBe("2026-06");
  });

  it("uses labeled period for custom start day", () => {
    // 2026-07-29 with start 28 belongs to labeled August → default = July
    expect(getDefaultAttendanceMonth(new Date(2026, 6, 29), 28)).toBe("2026-07");
    // 2026-07-20 with start 28 belongs to labeled July → default = June
    expect(getDefaultAttendanceMonth(new Date(2026, 6, 20), 28)).toBe("2026-06");
  });
});

describe("detectDominantMonthFromDates", () => {
  it("counts labeled periods, not calendar months", () => {
    const dates = [
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-06-01",
      "2026-06-02",
    ];
    expect(detectDominantMonthFromDates(dates, 28)).toBe("2026-06");
  });
});

describe("detectImportMonthMismatch", () => {
  it("suggests the dominant labeled month", () => {
    const dates = Array.from({ length: 20 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `2026-05-${day}`;
    });
    const mismatch = detectImportMonthMismatch("2026-06", dates, 1);
    expect(mismatch?.detectedMonth).toBe("2026-05");
  });
});
