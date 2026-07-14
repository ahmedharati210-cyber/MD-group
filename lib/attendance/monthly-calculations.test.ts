import { describe, expect, it } from "vitest";
import {
  computeDayRecord,
  diffMinutes,
  incompletePunchDay,
} from "@/lib/attendance/monthly-calculations";

describe("monthly-calculations", () => {
  it("treats same-time punch as incomplete", () => {
    const result = computeDayRecord({
      firstCheckIn: "09:00",
      lastCheckOut: "09:00",
    });
    expect(result.notes).toBe(incompletePunchDay().notes);
    expect(result.isAbsent).toBe(false);
  });

  it("marks empty punch as absent", () => {
    const result = computeDayRecord({
      firstCheckIn: null,
      lastCheckOut: null,
    });
    expect(result.isAbsent).toBe(true);
    expect(result.notes).toBe("غياب");
  });

  it("handles overnight span via diffMinutes", () => {
    expect(diffMinutes("22:00", "06:00")).toBe(8 * 60);
  });

  it("detects full-time shift from long session", () => {
    const result = computeDayRecord({
      firstCheckIn: "08:00",
      lastCheckOut: "22:30",
    });
    expect(result.shiftType).toBe("دوام كامل");
    expect(result.lateMinutes).toBe(0);
  });

  it("counts late minutes for full-time day using 09:00 fallback", () => {
    const result = computeDayRecord({
      firstCheckIn: "09:20",
      lastCheckOut: "19:20",
    });
    expect(result.shiftType).toBe("دوام كامل");
    expect(result.lateMinutes).toBe(5);
  });
});
