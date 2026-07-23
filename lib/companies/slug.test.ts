import { describe, expect, it } from "vitest";
import {
  resolveCompanySlug,
  slugify,
  withSlugSuffix,
} from "@/lib/companies/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("Lazord Hotel")).toBe("lazord-hotel");
  });

  it("strips non-latin characters", () => {
    expect(slugify("فندق Lazord!")).toBe("lazord");
  });
});

describe("resolveCompanySlug", () => {
  it("normalizes mixed-case user input", () => {
    expect(
      resolveCompanySlug({ slug: "Lazord", name_en: "Ignored", name_ar: "س" }),
    ).toBe("lazord");
  });

  it("falls back to English name when slug is empty", () => {
    expect(
      resolveCompanySlug({
        slug: "",
        name_en: "United Construction",
        name_ar: "شركة",
      }),
    ).toBe("united-construction");
  });

  it("generates company-* when names yield no latin slug", () => {
    const slug = resolveCompanySlug({
      slug: "",
      name_en: "",
      name_ar: "فندق لازورد",
    });
    expect(slug).toMatch(/^company-[a-z0-9]{6}$/);
  });
});

describe("withSlugSuffix", () => {
  it("appends a random suffix", () => {
    expect(withSlugSuffix("lazord")).toMatch(/^lazord-[a-z0-9]{6}$/);
  });
});
