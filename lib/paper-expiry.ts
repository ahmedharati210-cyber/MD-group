/**
 * Date-only helpers for paper expiry badges (YYYY-MM-DD).
 * Cron uses Postgres `expires_on - interval '1 month'` via RPC for exact parity.
 */

/** Today as UTC YYYY-MM-DD (matches typical `date` column string comparisons). */
export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Normalize a Postgres `date` or timestamptz string to `YYYY-MM-DD`.
 * Required before lexicographic compare — e.g. `2024-06-11T00:00:00+00:00` must not
 * be compared directly to `2026-05-12` or ordering breaks.
 */
export function toDateOnlyIso(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Subtract whole calendar months from a calendar day (mirrors common SQL date behavior). */
export function subtractCalendarMonthsFromIso(iso: string, months: number): string {
  const dateOnly = toDateOnlyIso(iso);
  if (!dateOnly) return iso.slice(0, 10);
  const parts = dateOnly.split("-").map((s) => parseInt(s, 10));
  const y = parts[0]!;
  const mo = parts[1]!;
  const d = parts[2]!;
  let nm = mo - months;
  let ny = y;
  while (nm < 1) {
    nm += 12;
    ny -= 1;
  }
  while (nm > 12) {
    nm -= 12;
    ny += 1;
  }
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const dd = Math.min(d, dim);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export type PaperExpiryVisualState = "none" | "ok" | "expiring" | "expired";

export function paperExpiryVisualState(
  expiresOn: string | null | undefined,
  todayIso = utcTodayIso(),
): PaperExpiryVisualState {
  const exp = toDateOnlyIso(expiresOn);
  if (!exp) return "none";
  const today = toDateOnlyIso(todayIso) ?? todayIso.slice(0, 10);
  if (exp < today) return "expired";
  const threshold = subtractCalendarMonthsFromIso(exp, 1);
  if (today >= threshold) return "expiring";
  return "ok";
}
