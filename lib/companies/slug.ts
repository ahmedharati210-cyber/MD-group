const SLUG_RE = /^[a-z0-9-]+$/;

/** Collapse a free-form string into a lowercase slug of Latin letters, digits, and dashes. */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function randomSuffix(length = 6): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length);
}

/**
 * Resolve a company slug: normalize user input, or auto-generate from names when empty.
 * Always returns a lowercase slug matching /^[a-z0-9-]+$/ with length >= 2.
 */
export function resolveCompanySlug(input: {
  slug?: string | null;
  name_en?: string | null;
  name_ar?: string | null;
}): string {
  const fromInput = slugify(input.slug ?? "");
  if (fromInput.length >= 2 && SLUG_RE.test(fromInput)) {
    return fromInput;
  }

  const fromEn = slugify(input.name_en ?? "");
  if (fromEn.length >= 2 && SLUG_RE.test(fromEn)) {
    return fromEn;
  }

  const fromAr = slugify(input.name_ar ?? "");
  if (fromAr.length >= 2 && SLUG_RE.test(fromAr)) {
    return fromAr;
  }

  return `company-${randomSuffix()}`;
}

/** Append a short random suffix for unique-constraint retries. */
export function withSlugSuffix(slug: string): string {
  const base = slug.replace(/-[a-z0-9]{6}$/, "").slice(0, 40) || "company";
  return `${base}-${randomSuffix()}`;
}

export function isSlugUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("duplicate") ||
    lower.includes("unique") ||
    lower.includes("companies_slug")
  );
}
