import { describe, expect, it } from "vitest";
import {
  formatAttendancePeriodLabel,
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

  it("allows start day 31 and clamps February", () => {
    const june = resolveAttendancePeriod("2026-06", 31);
    expect(june?.startDate).toBe("2026-05-31");
    expect(june?.endDate).toBe("2026-06-30");

    // Labeled March 2026: previous Feb has 28 days → clamp start to Feb 28
    const march = resolveAttendancePeriod("2026-03", 31);
    expect(march?.startDate).toBe("2026-02-28");
    expect(march?.endDate).toBe("2026-03-30");
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
