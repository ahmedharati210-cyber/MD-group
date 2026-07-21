import { describe, expect, it } from "vitest";
import { isFeatureEnabled } from "@/lib/features";
import type { AppFeature } from "@/types/db";

/**
 * Mirrors getAttendanceCompanies(attendanceEnabledOnly) eligibility.
 * MD Group has null features; إعمار اليوم has an explicit list without attendance.
 */
function companyAppearsInAttendancePicker(
  enabledFeatures: AppFeature[] | null | undefined,
): boolean {
  return isFeatureEnabled("attendance", enabledFeatures);
}

describe("attendance company picker eligibility", () => {
  it("includes MD Group when enabled_features is null (all features on)", () => {
    expect(companyAppearsInAttendancePicker(null)).toBe(true);
  });

  it("includes companies with explicit attendance", () => {
    expect(
      companyAppearsInAttendancePicker([
        "attendance",
        "papers",
        "mail",
        "contacts",
      ]),
    ).toBe(true);
  });

  it("excludes إعمار اليوم-style lists without attendance", () => {
    expect(
      companyAppearsInAttendancePicker([
        "papers",
        "mail",
        "contacts",
        "timeline",
        "reports",
        "requests",
        "claims",
        "maps",
        "warnings",
      ]),
    ).toBe(false);
  });
});
