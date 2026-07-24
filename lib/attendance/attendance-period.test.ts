import { describe, expect, it } from "vitest";
import {
  formatAttendancePeriodLabel,
  resolveAttendanceLabelForDate,
  resolveAttendancePeriod,
} from "@/lib/attendance/attendance-period";

describe("resolveAttendancePeriod", () => {
  it("keeps calendar months when start day is 1", () => {
    const period = resolveAttendancePeriod("2026-06", 1);
    expect(period?.startDate).toBe("2026-06-01");
    expect(period?.endDate).toBe("2026-06-30");
    expect(period?.days).toHaveLength(30);
    expect(period?.days[0]).toBe("2026-06-01");
    expect(period?.days.at(-1)).toBe("2026-06-30");
  });

  it("uses previous-month start through labeled-month day-before for day 28", () => {
    const period = resolveAttendancePeriod("2026-06", 28);
    expect(period?.startDate).toBe("2026-05-28");
    expect(period?.endDate).toBe("2026-06-27");
    expect(period?.days[0]).toBe("2026-05-28");
    expect(period?.days.at(-1)).toBe("2026-06-27");
    expect(period?.days).toHaveLength(31);
  });

  it("clamps safely around February for start day 28", () => {
    // Labeled March with start 28 → Feb 28 – Mar 27 (2026 is not a leap year)
    const march = resolveAttendancePeriod("2026-03", 28);
    expect(march?.startDate).toBe("2026-02-28");
    expect(march?.endDate).toBe("2026-03-27");

    // Labeled February → Jan 28 – Feb 27
    const feb = resolveAttendancePeriod("2026-02", 28);
    expect(feb?.startDate).toBe("2026-01-28");
    expect(feb?.endDate).toBe("2026-02-27");
  });

  it("allows start day 31 and clamps February without overlap", () => {
    const june = resolveAttendancePeriod("2026-06", 31);
    expect(june?.startDate).toBe("2026-05-31");
    // End is day before July's start (Jun 30), so Jun 30 belongs only to July
    expect(june?.endDate).toBe("2026-06-29");

    // Labeled March 2026: previous Feb has 28 days → clamp start to Feb 28
    const march = resolveAttendancePeriod("2026-03", 31);
    expect(march?.startDate).toBe("2026-02-28");
    expect(march?.endDate).toBe("2026-03-30");
  });

  it("keeps adjacent periods disjoint for start days 29–31", () => {
    for (const startDay of [29, 30, 31]) {
      // Non-leap Feb↔Mar
      const feb2026 = resolveAttendancePeriod("2026-02", startDay);
      const mar2026 = resolveAttendancePeriod("2026-03", startDay);
      expect(feb2026).not.toBeNull();
      expect(mar2026).not.toBeNull();
      expect(feb2026!.endDate < mar2026!.startDate).toBe(true);

      // Leap Feb↔Mar
      const feb2024 = resolveAttendancePeriod("2024-02", startDay);
      const mar2024 = resolveAttendancePeriod("2024-03", startDay);
      expect(feb2024!.endDate < mar2024!.startDate).toBe(true);

      // Jan↔Feb and short→long months (Apr 30 / May 31)
      const jan = resolveAttendancePeriod("2026-01", startDay);
      const feb = resolveAttendancePeriod("2026-02", startDay);
      expect(jan!.endDate < feb!.startDate).toBe(true);

      const may = resolveAttendancePeriod("2026-05", startDay);
      const jun = resolveAttendancePeriod("2026-06", startDay);
      expect(may!.endDate < jun!.startDate).toBe(true);
    }
  });

  it("formats an Arabic period label", () => {
    expect(formatAttendancePeriodLabel("2026-05-28", "2026-06-27")).toContain(
      "مايو",
    );
    expect(formatAttendancePeriodLabel("2026-05-28", "2026-06-27")).toContain(
      "يونيو",
    );
  });
});

describe("resolveAttendanceLabelForDate", () => {
  it("maps prefix days of the previous calendar month to the next labeled month", () => {
    // Labeled June with start 28 → 2026-05-28 … 2026-06-27
    expect(resolveAttendanceLabelForDate("2026-05-29", 28)).toBe("2026-06");
    expect(resolveAttendanceLabelForDate("2026-05-31", 28)).toBe("2026-06");
  });

  it("keeps mid-month dates in their own labeled month", () => {
    expect(resolveAttendanceLabelForDate("2026-05-15", 28)).toBe("2026-05");
    expect(resolveAttendanceLabelForDate("2026-06-15", 28)).toBe("2026-06");
  });

  it("uses the calendar month when start day is 1", () => {
    expect(resolveAttendanceLabelForDate("2026-06-15", 1)).toBe("2026-06");
    expect(resolveAttendanceLabelForDate("2026-05-31", 1)).toBe("2026-05");
  });
});
