import { describe, expect, it } from "vitest";
import {
  ANNUAL_LEAVE_ENTITLEMENT,
  ANNUAL_LEAVE_TYPE,
  balanceDeltaForLeaveChange,
  formatLeaveBalanceWarning,
  isBalanceExhausted,
  leaveTypeToBalancePool,
  SICK_LEAVE_ENTITLEMENT,
  SICK_LEAVE_TYPE,
} from "@/lib/attendance/leave-balance";

describe("leaveTypeToBalancePool", () => {
  it("maps yearly and sick leave only", () => {
    expect(leaveTypeToBalancePool(ANNUAL_LEAVE_TYPE)).toBe("annual");
    expect(leaveTypeToBalancePool(SICK_LEAVE_TYPE)).toBe("sick");
    expect(leaveTypeToBalancePool("عطلة")).toBeNull();
    expect(leaveTypeToBalancePool("إجازة طارئة")).toBeNull();
    expect(leaveTypeToBalancePool(null)).toBeNull();
  });
});

describe("balanceDeltaForLeaveChange", () => {
  it("deducts on create", () => {
    expect(balanceDeltaForLeaveChange(null, ANNUAL_LEAVE_TYPE)).toEqual({
      annual: -1,
      sick: 0,
    });
    expect(balanceDeltaForLeaveChange(null, SICK_LEAVE_TYPE)).toEqual({
      annual: 0,
      sick: -1,
    });
  });

  it("restores on clear", () => {
    expect(balanceDeltaForLeaveChange(ANNUAL_LEAVE_TYPE, null)).toEqual({
      annual: 1,
      sick: 0,
    });
  });

  it("switches between yearly and sick", () => {
    expect(
      balanceDeltaForLeaveChange(ANNUAL_LEAVE_TYPE, SICK_LEAVE_TYPE),
    ).toEqual({ annual: 1, sick: -1 });
  });

  it("ignores non-deducting types and no-ops", () => {
    expect(balanceDeltaForLeaveChange(null, "عطلة")).toEqual({
      annual: 0,
      sick: 0,
    });
    expect(
      balanceDeltaForLeaveChange(ANNUAL_LEAVE_TYPE, ANNUAL_LEAVE_TYPE),
    ).toEqual({ annual: 0, sick: 0 });
    expect(balanceDeltaForLeaveChange("غياب", "بدون أجر")).toEqual({
      annual: 0,
      sick: 0,
    });
  });
});

describe("isBalanceExhausted / warning", () => {
  it("treats zero and negative as exhausted", () => {
    expect(isBalanceExhausted(0)).toBe(true);
    expect(isBalanceExhausted(-1)).toBe(true);
    expect(isBalanceExhausted(1)).toBe(false);
  });

  it("warns when remaining goes negative after consume", () => {
    expect(
      formatLeaveBalanceWarning({
        annualRemaining: -1,
        sickRemaining: SICK_LEAVE_ENTITLEMENT,
        delta: { annual: -1, sick: 0 },
      }),
    ).toContain("السنوية");
    expect(
      formatLeaveBalanceWarning({
        annualRemaining: ANNUAL_LEAVE_ENTITLEMENT,
        sickRemaining: 2,
        delta: { annual: 0, sick: -1 },
      }),
    ).toBeNull();
  });
});
