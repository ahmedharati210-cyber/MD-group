import { describe, expect, it } from "vitest";
import {
  canInteractWithTesting,
  canManageTesting,
  hasTestingAccess,
} from "@/lib/itqan-testing";
import {
  QA_SEVERITY_META,
  computeQaProgress,
  matchesQaSearch,
  partitionQaItems,
  recentCompletedQaItems,
  recentOpenQaItems,
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

describe("partitionQaItems", () => {
  it("moves only pass to done; tasks first, then bug → improve → untested", () => {
    const { pending, done } = partitionQaItems([
      { id: "1", item_kind: "test", result: "pass", tested_at: "2026-07-01T10:00:00Z" },
      { id: "2", item_kind: "task", result: null, tested_at: null },
      { id: "3", item_kind: "test", result: null, tested_at: null },
      { id: "4", item_kind: "test", result: "bug", tested_at: "2026-07-03T10:00:00Z" },
      { id: "5", item_kind: "test", result: "improve", tested_at: "2026-07-02T10:00:00Z" },
      { id: "6", item_kind: "test", result: "pass", tested_at: "2026-07-04T10:00:00Z" },
    ]);
    expect(done.map((i) => i.id)).toEqual(["6", "1"]);
    expect(pending.map((i) => i.id)).toEqual(["2", "4", "5", "3"]);
  });
});

describe("matchesQaSearch", () => {
  it("matches title or description case-insensitively", () => {
    expect(
      matchesQaSearch({ title: "Login flow", description: null }, "login"),
    ).toBe(true);
    expect(
      matchesQaSearch(
        { title: "Auth", description: "Wrong password error" },
        "PASSWORD",
      ),
    ).toBe(true);
    expect(
      matchesQaSearch({ title: "Auth", description: null }, "xyz"),
    ).toBe(false);
  });

  it("returns true for empty query", () => {
    expect(matchesQaSearch({ title: "x", description: null }, "  ")).toBe(true);
  });
});

describe("recentCompletedQaItems", () => {
  it("returns newest pass items only (excludes bug/improve)", () => {
    const recent = recentCompletedQaItems(
      [
        { id: "a", item_kind: "test", result: "pass", tested_at: "2026-07-01T10:00:00Z" },
        { id: "b", item_kind: "task", result: null, tested_at: null },
        { id: "c", item_kind: "test", result: "bug", tested_at: "2026-07-05T10:00:00Z" },
        { id: "d", item_kind: "test", result: null, tested_at: null },
        { id: "e", item_kind: "test", result: "improve", tested_at: "2026-07-04T10:00:00Z" },
        { id: "f", item_kind: "test", result: "pass", tested_at: "2026-07-06T10:00:00Z" },
      ],
      2,
    );
    expect(recent.map((i) => i.id)).toEqual(["f", "a"]);
  });
});

describe("recentOpenQaItems", () => {
  it("sorts bugs by severity then improve, then tested_at desc", () => {
    const open = recentOpenQaItems(
      [
        {
          id: "low",
          item_kind: "test",
          result: "bug",
          severity: "low",
          tested_at: "2026-07-06T10:00:00Z",
        },
        {
          id: "crit",
          item_kind: "test",
          result: "bug",
          severity: "critical",
          tested_at: "2026-07-01T10:00:00Z",
        },
        {
          id: "imp",
          item_kind: "test",
          result: "improve",
          severity: null,
          tested_at: "2026-07-07T10:00:00Z",
        },
        {
          id: "pass",
          item_kind: "test",
          result: "pass",
          severity: null,
          tested_at: "2026-07-08T10:00:00Z",
        },
        {
          id: "high-new",
          item_kind: "test",
          result: "bug",
          severity: "high",
          tested_at: "2026-07-05T10:00:00Z",
        },
        {
          id: "high-old",
          item_kind: "test",
          result: "bug",
          severity: "high",
          tested_at: "2026-07-02T10:00:00Z",
        },
      ],
      10,
    );
    expect(open.map((i) => i.id)).toEqual([
      "crit",
      "high-new",
      "high-old",
      "low",
      "imp",
    ]);
  });
});

describe("computeQaProgress", () => {
  it("counts tests only and derives open = bugs + improves", () => {
    const stats = computeQaProgress([
      { item_kind: "test", result: "pass" },
      { item_kind: "test", result: "bug" },
      { item_kind: "test", result: "improve" },
      { item_kind: "test", result: null },
      { item_kind: "task", result: null },
    ]);
    expect(stats).toMatchObject({
      total: 4,
      tested: 3,
      passes: 1,
      bugs: 1,
      improves: 1,
      open: 2,
      taskCount: 1,
      pct: 75,
    });
  });
});
