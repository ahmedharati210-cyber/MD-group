/**
 * Last-used list-filter persistence (client-side localStorage).
 *
 * Each list page owns its storage key (`portal_filters:` + pathname) and the
 * set of query keys it is allowed to remember. Pagination (`page`, `donePage`)
 * and one-off drill-downs (`day`, `personId`, `error`) are never stored.
 */

export const LIST_FILTER_STORAGE_PREFIX = "portal_filters:";
export const LIST_FILTER_Q_MAX_LENGTH = 200;

export type QaFilterChip = "all" | "pending" | "open" | "tasks";

export function parseQaFilter(raw: string | null | undefined): QaFilterChip {
  if (raw === "pending" || raw === "open" || raw === "tasks") return raw;
  return "all";
}

export const LIST_FILTER_KEYS = {
  attendance: ["companyId", "branchId", "month", "q"],
  attendanceSummary: ["companyId", "branchId", "month"],
  attendanceBranches: ["companyId", "branchId", "q"],
  employees: ["companyId", "q"],
  papers: ["q", "category", "expiry", "companyId"],
  mail: ["direction", "q", "companyId"],
  contacts: ["q", "trade", "companyId"],
  reports: ["companyId", "projectId", "authorId", "from", "to"],
  claims: ["q", "project_id", "companyId"],
  requests: ["status", "type", "companyId"],
  maps: ["companyId", "project_id", "q"],
  notifications: ["tab", "companyId"],
  timeline: ["companyId"],
  timelineDrafts: ["companyId"],
  audit: ["action", "entity", "actorId"],
  testing: ["filter", "q"],
} as const;

export type ListFilterStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storageKey(path: string): string {
  return `${LIST_FILTER_STORAGE_PREFIX}${path}`;
}

function getDefaultStorage(): ListFilterStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function truncateQuery(value: string): string {
  if (value.length <= LIST_FILTER_Q_MAX_LENGTH) return value;
  return value.slice(0, LIST_FILTER_Q_MAX_LENGTH);
}

export function pickListFilters(
  params: URLSearchParams,
  keys: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const raw = params.get(key)?.trim() ?? "";
    if (!raw) continue;
    out[key] = key === "q" ? truncateQuery(raw) : raw;
  }
  return out;
}

export function urlHasListFilters(
  params: URLSearchParams,
  keys: readonly string[],
): boolean {
  return keys.some((key) => Boolean(params.get(key)?.trim()));
}

export function buildListFilterSearch(
  values: Record<string, string>,
  keys: readonly string[],
): string {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = values[key]?.trim();
    if (value) next.set(key, key === "q" ? truncateQuery(value) : value);
  }
  return next.toString();
}

export function saveListFilters(
  path: string,
  params: URLSearchParams,
  keys: readonly string[],
  storage: ListFilterStorage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  const picked = pickListFilters(params, keys);
  try {
    if (Object.keys(picked).length === 0) {
      storage.removeItem(storageKey(path));
      return;
    }
    storage.setItem(storageKey(path), JSON.stringify(picked));
  } catch {
    // Private browsing / quota — persistence is best-effort.
  }
}

export function readListFilters(
  path: string,
  keys: readonly string[],
  storage: ListFilterStorage | null = getDefaultStorage(),
): Record<string, string> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(path));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = record[key];
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      out[key] = key === "q" ? truncateQuery(trimmed) : trimmed;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function clearListFilters(
  path: string,
  storage: ListFilterStorage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(storageKey(path));
  } catch {
    // ignore
  }
}
