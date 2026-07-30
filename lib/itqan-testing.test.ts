import { describe, expect, it } from "vitest";
import {
  canInteractWithTesting,
  canManageTesting,
  hasTestingAccess,
} from "@/lib/itqan-testing";
import {
  QA_SEVERITY_META,
  validateQaResultSubmit,
} from "@/lib/qa-testing-format";
import type { Profile } from "@/types/db";

type AccessProfile = Pick<
  Profile,
  "role" | "is_super_admin" | "testing_access_enabled"
>;

function profile(overrides: Partial<AccessProfile> = {}): AccessProfile {
  return {
    role: "employee",
    is_super_admin: false,
    testing_access_enabled: false,
    ...overrides,
  };
}

describe("hasTestingAccess", () => {
  it("allows superadmin regardless of flag", () => {
    expect(
      hasTestingAccess(profile({ is_super_admin: true })),
    ).toBe(true);
  });

  it("allows any role when testing_access_enabled", () => {
    expect(
      hasTestingAccess(profile({ testing_access_enabled: true, role: "owner" })),
    ).toBe(true);
    expect(
      hasTestingAccess(
        profile({ testing_access_enabled: true, role: "employee" }),
      ),
    ).toBe(true);
  });

  it("denies when flag is off and not superadmin", () => {
    expect(hasTestingAccess(profile())).toBe(false);
  });
});

describe("canInteractWithTesting", () => {
  it("allows superadmin", () => {
    expect(
      canInteractWithTesting(profile({ is_super_admin: true, role: "owner" })),
    ).toBe(true);
  });

  it("allows non-owner with access", () => {
    expect(
      canInteractWithTesting(
        profile({ testing_access_enabled: true, role: "employee" }),
      ),
    ).toBe(true);
  });

  it("denies owner even with access (view-only)", () => {
    expect(
      canInteractWithTesting(
        profile({ testing_access_enabled: true, role: "owner" }),
      ),
    ).toBe(false);
  });

  it("denies when access flag is off", () => {
    expect(
      canInteractWithTesting(profile({ role: "employee" })),
    ).toBe(false);
  });
});

describe("canManageTesting", () => {
  it("allows superadmin", () => {
    expect(
      canManageTesting(profile({ is_super_admin: true })),
    ).toBe(true);
  });

  it("allows md_admin and company_manager with access", () => {
    expect(
      canManageTesting(
        profile({ testing_access_enabled: true, role: "md_admin" }),
      ),
    ).toBe(true);
    expect(
      canManageTesting(
        profile({ testing_access_enabled: true, role: "company_manager" }),
      ),
    ).toBe(true);
  });

  it("denies employee and owner even with access", () => {
    expect(
      canManageTesting(
        profile({ testing_access_enabled: true, role: "employee" }),
      ),
    ).toBe(false);
    expect(
      canManageTesting(
        profile({ testing_access_enabled: true, role: "owner" }),
      ),
    ).toBe(false);
  });

  it("denies managers without the access flag", () => {
    expect(
      canManageTesting(profile({ role: "md_admin" })),
    ).toBe(false);
  });
});

/** Progress % excludes tasks — mirrors UI calculation. */
function computeTestProgress(
  items: { item_kind?: "test" | "task"; result: string | null }[],
) {
  const testItems = items.filter((i) => (i.item_kind ?? "test") !== "task");
  const total = testItems.length;
  const tested = testItems.filter((i) => i.result != null).length;
  const pct = total > 0 ? Math.round((tested / total) * 100) : 0;
  return { total, tested, pct, taskCount: items.length - total };
}

describe("QA progress excludes tasks", () => {
  it("ignores tasks when computing percent", () => {
    const stats = computeTestProgress([
      { item_kind: "test", result: "pass" },
      { item_kind: "test", result: null },
      { item_kind: "task", result: null },
      { item_kind: "task", result: null },
    ]);
    expect(stats.total).toBe(2);
    expect(stats.tested).toBe(1);
    expect(stats.pct).toBe(50);
    expect(stats.taskCount).toBe(2);
  });

  it("returns 0% with only tasks", () => {
    const stats = computeTestProgress([
      { item_kind: "task", result: null },
    ]);
    expect(stats.total).toBe(0);
    expect(stats.pct).toBe(0);
    expect(stats.taskCount).toBe(1);
  });
});

describe("validateQaResultSubmit", () => {
  it("allows pass without note or severity", () => {
    expect(
      validateQaResultSubmit({ result: "pass", resultNote: "" }),
    ).toBeNull();
  });

  it("requires note for improve", () => {
    expect(
      validateQaResultSubmit({ result: "improve", resultNote: "  " }),
    ).toBe("الملاحظة مطلوبة عند تسجيل خلل أو تحسين");
    expect(
      validateQaResultSubmit({
        result: "improve",
        resultNote: "يحتاج توضيح أكثر",
      }),
    ).toBeNull();
  });

  it("requires note, severity, and steps for bug", () => {
    expect(
      validateQaResultSubmit({ result: "bug", resultNote: "حدث خطأ" }),
    ).toBe("درجة الخطورة مطلوبة عند تسجيل خلل");
    expect(
      validateQaResultSubmit({
        result: "bug",
        resultNote: "حدث خطأ",
        severity: "high",
      }),
    ).toBe("خطوات إعادة الإنتاج مطلوبة عند تسجيل خلل");
    expect(
      validateQaResultSubmit({
        result: "bug",
        resultNote: "حدث خطأ",
        severity: "high",
        stepsToReproduce: "1. افتح الصفحة\n2. اضغط حفظ",
        expectedBehavior: "يجب أن يحفظ",
      }),
    ).toBeNull();
  });
});

describe("QA_SEVERITY_META", () => {
  it("covers all severities with Arabic labels", () => {
    expect(QA_SEVERITY_META.low.label).toBe("منخفض");
    expect(QA_SEVERITY_META.medium.label).toBe("متوسط");
    expect(QA_SEVERITY_META.high.label).toBe("عالٍ");
    expect(QA_SEVERITY_META.critical.label).toBe("حرج");
  });
});
