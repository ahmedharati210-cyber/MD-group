import { afterEach, describe, expect, it } from "vitest";
import {
  LIST_FILTER_KEYS,
  LIST_FILTER_Q_MAX_LENGTH,
  LIST_FILTER_STORAGE_PREFIX,
  buildListFilterSearch,
  clearListFilters,
  pickListFilters,
  readListFilters,
  saveListFilters,
  urlHasListFilters,
  type ListFilterStorage,
} from "@/lib/portal-list-filters";

function memoryStorage(): ListFilterStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

describe("pickListFilters", () => {
  it("keeps only allowed keys that have values", () => {
    const params = new URLSearchParams(
      "companyId=abc&q=ahmed&page=2&day=2026-06-01",
    );
    expect(pickListFilters(params, LIST_FILTER_KEYS.attendance)).toEqual({
      companyId: "abc",
      q: "ahmed",
    });
  });

  it("ignores blank values", () => {
    const params = new URLSearchParams("companyId=&q=%20");
    expect(pickListFilters(params, LIST_FILTER_KEYS.employees)).toEqual({});
  });

  it("truncates q to the max length", () => {
    const long = "x".repeat(LIST_FILTER_Q_MAX_LENGTH + 50);
    const params = new URLSearchParams({ q: long, companyId: "c1" });
    const picked = pickListFilters(params, LIST_FILTER_KEYS.employees);
    expect(picked.q).toHaveLength(LIST_FILTER_Q_MAX_LENGTH);
    expect(picked.companyId).toBe("c1");
  });
});

describe("urlHasListFilters", () => {
  it("is false when only pagination is present", () => {
    expect(
      urlHasListFilters(new URLSearchParams("page=3"), LIST_FILTER_KEYS.reports),
    ).toBe(false);
  });

  it("is true when an allowed key has a value", () => {
    expect(
      urlHasListFilters(
        new URLSearchParams("from=2026-01-01"),
        LIST_FILTER_KEYS.reports,
      ),
    ).toBe(true);
  });
});

describe("save / read / clear", () => {
  const path = "/portal/reports";
  const keys = LIST_FILTER_KEYS.reports;

  afterEach(() => {
    // no shared storage between tests — each uses its own memoryStorage
  });

  it("round-trips allowed keys and drops ignored ones", () => {
    const storage = memoryStorage();
    saveListFilters(
      path,
      new URLSearchParams("companyId=c1&from=2026-01-01&page=4"),
      keys,
      storage,
    );
    expect(storage.data.get(`${LIST_FILTER_STORAGE_PREFIX}${path}`)).toBe(
      JSON.stringify({ companyId: "c1", from: "2026-01-01" }),
    );
    expect(readListFilters(path, keys, storage)).toEqual({
      companyId: "c1",
      from: "2026-01-01",
    });
  });

  it("clears storage when saving empty filters", () => {
    const storage = memoryStorage();
    saveListFilters(
      path,
      new URLSearchParams("companyId=c1"),
      keys,
      storage,
    );
    saveListFilters(path, new URLSearchParams(""), keys, storage);
    expect(readListFilters(path, keys, storage)).toBeNull();
  });

  it("clearListFilters removes the stored entry", () => {
    const storage = memoryStorage();
    saveListFilters(
      path,
      new URLSearchParams("authorId=u1"),
      keys,
      storage,
    );
    clearListFilters(path, storage);
    expect(readListFilters(path, keys, storage)).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    const storage = memoryStorage();
    storage.setItem(`${LIST_FILTER_STORAGE_PREFIX}${path}`, "{not-json");
    expect(readListFilters(path, keys, storage)).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    const storage = memoryStorage();
    storage.setItem(`${LIST_FILTER_STORAGE_PREFIX}${path}`, '["companyId"]');
    expect(readListFilters(path, keys, storage)).toBeNull();
  });

  it("ignores keys that are not in the allow-list", () => {
    const storage = memoryStorage();
    storage.setItem(
      `${LIST_FILTER_STORAGE_PREFIX}${path}`,
      JSON.stringify({ companyId: "c1", hack: "nope", page: "9" }),
    );
    expect(readListFilters(path, keys, storage)).toEqual({ companyId: "c1" });
  });

  it("survives a throwing storage (private browsing)", () => {
    const throwing: ListFilterStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    };
    expect(() =>
      saveListFilters(path, new URLSearchParams("q=a"), ["q"], throwing),
    ).not.toThrow();
    expect(readListFilters(path, ["q"], throwing)).toBeNull();
    expect(() => clearListFilters(path, throwing)).not.toThrow();
  });
});

describe("buildListFilterSearch", () => {
  it("emits only allowed non-empty keys in table order", () => {
    expect(
      buildListFilterSearch(
        { q: "  ali  ", month: "", companyId: "c1", extra: "x" },
        LIST_FILTER_KEYS.attendance,
      ),
    ).toBe("companyId=c1&q=ali");
  });
});
