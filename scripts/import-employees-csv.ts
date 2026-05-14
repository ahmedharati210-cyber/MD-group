/**
 * Bulk-import employees from the Arabic HR CSV into `employee_directory` (HR data only;
 * no Supabase Auth users — match portal "add employee").
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local (or env).
 *
 * Usage:
 *   pnpm employees:list-companies
 *   cp scripts/csv-company-map.example.json scripts/csv-company-map.local.json
 *   # edit UUIDs, then:
 *   pnpm employees:import -- --dry-run --csv=/path/to/file.csv --company-map=scripts/csv-company-map.local.json
 *   pnpm employees:import -- --apply --csv=... --company-map=...
 *
 * Email: valid CSV cells become `contact_email`. Invalid/missing get no contact email; a stable
 * internal dedupe key + notes in `hr_notes`. Skips if contact email is already in Auth, or
 * duplicate (company + contact_email / national_id) in CSV, `employee_directory`, or `profiles`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

// ── env loading (no dotenv dependency) ───────────────────────────────────────

function loadEnvFile(fileName: string): void {
  const p = resolve(process.cwd(), fileName);
  if (!existsSync(p)) return;
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function loadEnv(): void {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
}

// ── CSV ──────────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === "," || c === "\t") && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(content: string): string[][] {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map(parseCsvLine);
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\u0640/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC");
}

type ColumnKey =
  | "company"
  | "full_name"
  | "date_of_birth"
  | "gender"
  | "nationality"
  | "passport_number"
  | "national_id"
  | "address"
  | "emergency_contact_name"
  | "emergency_contact_phone"
  | "emergency_contact_relationship"
  | "education_level"
  | "department"
  | "job_title"
  | "hired_at"
  | "contract_type"
  | "contract_end_date"
  | "org_role"
  | "phone"
  | "email"
  | "password"
  | "blood_type"
  | "status";

const HEADER_RULES: { key: ColumnKey; test: (n: string) => boolean }[] = [
  { key: "company", test: (n) => n.includes("شرك") && (n.includes("ة") || n.includes("ه")) },
  { key: "full_name", test: (n) => n.includes("اسم") && n.includes("موظف") },
  { key: "date_of_birth", test: (n) => n.includes("ميلاد") },
  { key: "gender", test: (n) => n === "الجنس" },
  { key: "nationality", test: (n) => n.includes("جنسية") },
  { key: "passport_number", test: (n) => n.includes("جواز") },
  { key: "national_id", test: (n) => n.includes("وطني") },
  {
    key: "emergency_contact_name",
    test: (n) => n.includes("جهة") && n.includes("اتصال") && n.includes("اسم"),
  },
  {
    key: "emergency_contact_phone",
    test: (n) => n.includes("جهة") && n.includes("اتصال") && n.includes("رقم"),
  },
  { key: "address", test: (n) => n.includes("عنوان") && !n.includes("جهة") },
  { key: "education_level", test: (n) => n.includes("تعليم") || n.includes("مستوى") },
  { key: "department", test: (n) => n.includes("ادارة") || n.includes("قسم") },
  { key: "job_title", test: (n) => n.includes("مسمو") || n.includes("وظيف") },
  { key: "hired_at", test: (n) => n.includes("توظيف") },
  { key: "contract_type", test: (n) => n.includes("نوع") && n.includes("عقد") },
  { key: "contract_end_date", test: (n) => n.includes("انتهاء") && n.includes("عقد") },
  { key: "org_role", test: (n) => n === "الدور" },
  { key: "phone", test: (n) => (n.includes("هاتف") && n.includes("رقم")) || n.includes("الهاتف") },
  { key: "email", test: (n) => n.includes("بريد") || n.includes("الكترون") },
  { key: "password", test: (n) => n.includes("مرور") },
  { key: "blood_type", test: (n) => n.includes("دم") || n.includes("فصيلة") },
  { key: "emergency_contact_relationship", test: (n) => n === "الصلة" || n === "صلة" },
  { key: "status", test: (n) => n.includes("حالة") },
];

function buildColumnIndex(headers: string[]): Partial<Record<ColumnKey, number>> {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const idx: Partial<Record<ColumnKey, number>> = {};
  for (const { key, test } of HEADER_RULES) {
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i)) continue;
      if (test(norm[i])) {
        idx[key] = i;
        used.add(i);
        break;
      }
    }
  }
  return idx;
}

function cell(row: string[], col: Partial<Record<ColumnKey, number>>, key: ColumnKey): string {
  const i = col[key];
  if (i === undefined) return "";
  const v = row[i];
  return v === undefined ? "" : v.trim();
}

// ── mappers ─────────────────────────────────────────────────────────────────

const BLOOD = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

function mapBlood(raw: string): string | null {
  const t = raw.replace(/\s/g, "").toUpperCase();
  if (!t) return null;
  if (BLOOD.has(t)) return t;
  return null;
}

function mapGender(raw: string): "male" | "female" | null {
  const n = normalizeHeader(raw);
  if (!n) return null;
  if (n.includes("ذكر")) return "male";
  if (n.includes("انث") || n.includes("أنث")) return "female";
  return null;
}

function mapEducation(raw: string): string | null {
  const n = normalizeHeader(raw);
  if (!n) return null;
  if (n.includes("دكتور") || n.includes("phd")) return "phd";
  if (n.includes("ماجستير")) return "master";
  if (n.includes("بكالور")) return "bachelor";
  if (n.includes("دبلوم")) return "diploma";
  if (n.includes("ثانوي") || n.includes("اعداد")) return "high_school";
  if (n.includes("معهد")) return "other";
  return "other";
}

/** Map contract description to DB enum; null if unknown/empty. */
function mapContractType(raw: string): "full_time" | "part_time" | "contract" | "intern" | null {
  const n = normalizeHeader(raw);
  if (!n) return null;
  if (n.includes("دائم") || n.includes("كامل")) return "full_time";
  if (n.includes("جزئ")) return "part_time";
  if (n.includes("متدر") || n.includes("trainee") || n.includes("متدرب")) return "intern";
  if (n.includes("شهر") || n.includes("اشهر") || n.includes("عقد")) return "contract";
  return "contract";
}

function mapActiveStatus(raw: string): boolean {
  const n = normalizeHeader(raw);
  if (!n) return true;
  if (n.includes("غير")) return false;
  if (n.includes("نشط")) return true;
  return true;
}

/**
 * Parse dates as day-first (D/M/Y) when three parts; month/year when two parts
 * and the second is 4-digit year.
 */
function parseToIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === "/" || s === "-" || s === ".") return null;
  const parts = s.split(/[\/\-.]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    if (Number.isFinite(b) && parts[1].length === 4) {
      const month = a;
      const year = b;
      if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const d = new Date(Date.UTC(year, month - 1, 1));
        return d.toISOString().slice(0, 10);
      }
    }
    return null;
  }
  if (parts.length === 3) {
    let day: number;
    let month: number;
    let year: number;
    // ISO / Excel: YYYY-MM-DD
    if (parts[0].length === 4 && /^\d+$/.test(parts[0])) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // Day-first D/M/Y
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year))
      return null;
    if (parts[2].length <= 2 && parts[0].length !== 4) year += year < 50 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100)
      return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
      return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

const emailSchema = z.string().email();

/** Known providers often typed without `.com` in spreadsheets. */
const EMAIL_DOMAIN_FIXES = [
  "gmail",
  "hotmail",
  "yahoo",
  "outlook",
  "icloud",
  "live",
  "msn",
  "protonmail",
  "proton",
  "aol",
] as const;

function tryNormalizeAndFixEmail(raw: string): { email: string; fixes: string[] } | null {
  const fixes: string[] = [];
  let t = raw.trim().toLowerCase();
  if (!t || t === "/" || t === "-" || t === ".") return null;

  const at = t.lastIndexOf("@");
  if (at <= 0 || at === t.length - 1) return null;
  const local = t.slice(0, at).trim();
  let domain = t.slice(at + 1).trim();
  if (!local || !domain) return null;

  const domBare = domain.replace(/\.+$/, "");
  for (const c of EMAIL_DOMAIN_FIXES) {
    if (domBare === c) {
      domain = `${c}.com`;
      fixes.push(`domain: @${c} → @${c}.com`);
      break;
    }
  }

  t = `${local}@${domain}`;
  const ok = emailSchema.safeParse(t);
  return ok.success ? { email: t, fixes } : null;
}

function defaultSyntheticEmailDomain(): string {
  const explicit = process.env.EMPLOYEE_IMPORT_EMAIL_DOMAIN?.trim();
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      const host = new URL(site).hostname;
      if (host) return `import.${host}`;
    } catch {
      /* ignore */
    }
  }
  return "example.com";
}

function stableSyntheticLocalPart(
  lineNumber: number,
  nationalId: string | null,
  fullName: string,
  rawCsv: string,
): string {
  const h = createHash("sha256")
    .update(`${lineNumber}|${nationalId ?? ""}|${fullName}|${rawCsv}`)
    .digest("hex")
    .slice(0, 14);
  return `import.${lineNumber}.${h}`;
}

/**
 * Valid CSV → `contactEmail` + same `dedupeEmail`. Invalid/missing → `contactEmail` null,
 * synthetic `dedupeEmail` only (not written to DB); notes go to hr_notes.
 */
function resolveImportEmail(
  rawCsv: string,
  lineNumber: number,
  nationalId: string | null,
  fullName: string,
): {
  dedupeEmail: string;
  contactEmail: string | null;
  hrNote: string | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const raw = rawCsv.trim();

  const fixed = tryNormalizeAndFixEmail(raw);
  if (fixed) {
    if (fixed.fixes.length) warnings.push(`email auto-fix: ${fixed.fixes.join("; ")}`);
    return { dedupeEmail: fixed.email, contactEmail: fixed.email, hrNote: null, warnings };
  }

  const domain = defaultSyntheticEmailDomain();
  const localPart = stableSyntheticLocalPart(lineNumber, nationalId, fullName, rawCsv);
  const dedupeEmail = `${localPart}@${domain}`;

  const note = raw
    ? `CSV email (invalid; not stored as contact_email): ${raw}`
    : `CSV email missing; internal dedupe key only (not stored): ${dedupeEmail}`;
  warnings.push(note);
  return { dedupeEmail, contactEmail: null, hrNote: note, warnings };
}

function mergeHrNotes(parts: (string | null | undefined)[]): string | null {
  const s = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
  return s.length > 0 ? s : null;
}

type CompanyRow = {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
};

function normalizeCompanyKey(s: string): string {
  return normalizeHeader(s).toLowerCase();
}

/** Resolve CSV company label to UUID using optional JSON map + DB fuzzy match. */
function resolveCompanyId(
  label: string,
  companies: CompanyRow[],
  manualMap: Record<string, string>,
): { id: string | null; note?: string } {
  const key = label.trim();
  if (!key) return { id: null, note: "empty company after carry-forward" };
  const nk = normalizeCompanyKey(key);
  if (manualMap[key]) return { id: manualMap[key] };
  if (manualMap[nk]) return { id: manualMap[nk] };
  for (const [k, v] of Object.entries(manualMap)) {
    if (normalizeCompanyKey(k) === nk) return { id: v };
  }
  const exactAr = companies.find((c) => c.name_ar.trim() === key);
  if (exactAr) return { id: exactAr.id };
  const exactEn = companies.find(
    (c) => c.name_en && c.name_en.trim().toLowerCase() === key.toLowerCase(),
  );
  if (exactEn) return { id: exactEn.id };
  const slug = companies.find((c) => c.slug.toLowerCase() === nk.replace(/\s+/g, "-"));
  if (slug) return { id: slug.id };
  const loose = companies.find(
    (c) =>
      normalizeCompanyKey(c.name_ar) === nk ||
      (c.name_en && normalizeCompanyKey(c.name_en) === nk),
  );
  if (loose) return { id: loose.id };
  return { id: null, note: `no company match for "${key}" — add to company map JSON` };
}

type PreparedRow = {
  lineNumber: number;
  full_name: string;
  /** Stable dedupe key for CSV rows (real email or synthetic; not always stored on row). */
  email: string;
  /** Stored on `employee_directory.contact_email` when CSV had a valid address. */
  contact_email: string | null;
  /** Raw value from CSV email column (for reports). */
  csv_email_raw: string;
  passwordFromCsv: string | null;
  company_id: string;
  company_label: string;
  phone: string | null;
  job_title: string | null;
  national_id: string | null;
  hired_at: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  nationality: string | null;
  address: string | null;
  department: string | null;
  contract_type: "full_time" | "part_time" | "contract" | "intern" | null;
  contract_end_date: string | null;
  passport_number: string | null;
  blood_type: string | null;
  education_level: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  hr_notes: string | null;
  is_active: boolean;
  skipReasons: string[];
  warnings: string[];
};

function prepareRow(
  row: string[],
  col: Partial<Record<ColumnKey, number>>,
  lineNumber: number,
  effectiveCompanyLabel: string,
  company_id: string | null,
  companyResolveNote: string | undefined,
): PreparedRow {
  const skipReasons: string[] = [];
  const warnings: string[] = [];

  const full_name = cell(row, col, "full_name").trim();
  if (full_name.length < 2) skipReasons.push("missing or short full_name");

  const csv_email_raw = cell(row, col, "email").trim();
  const national_id = cell(row, col, "national_id") || null;
  const {
    dedupeEmail,
    contactEmail,
    hrNote: emailHrNote,
    warnings: emailWarnings,
  } = resolveImportEmail(csv_email_raw, lineNumber, national_id, full_name);
  warnings.push(...emailWarnings);

  if (!company_id) skipReasons.push(companyResolveNote ?? "unresolved company_id");

  const pwdRaw = cell(row, col, "password").trim();
  const passwordFromCsv = pwdRaw.length >= 8 ? pwdRaw : null;
  if (pwdRaw && pwdRaw.length < 8)
    warnings.push("password column too short (ignored for HR import)");
  else if (pwdRaw.length >= 8)
    warnings.push("password column present (ignored — import is HR-only, no Auth user)");

  const dobRaw = cell(row, col, "date_of_birth");
  const hiredRaw = cell(row, col, "hired_at");
  const endRaw = cell(row, col, "contract_end_date");

  const date_of_birth = parseToIsoDate(dobRaw);
  if (dobRaw && !date_of_birth) warnings.push(`date_of_birth not parsed: "${dobRaw}"`);

  const hired_at = parseToIsoDate(hiredRaw);
  if (hiredRaw && !hired_at) warnings.push(`hired_at not parsed: "${hiredRaw}"`);

  const contract_end_date = parseToIsoDate(endRaw);
  if (endRaw && !contract_end_date) warnings.push(`contract_end_date not parsed: "${endRaw}"`);

  const bloodRaw = cell(row, col, "blood_type");
  const blood_type = mapBlood(bloodRaw);
  if (bloodRaw && !blood_type) warnings.push(`blood_type not mapped: "${bloodRaw}"`);

  const eduRaw = cell(row, col, "education_level");
  const education_level = mapEducation(eduRaw);

  const contract_type = mapContractType(cell(row, col, "contract_type"));

  const orgRole = cell(row, col, "org_role").trim();
  const hr_notes = mergeHrNotes([
    orgRole ? `الدور (من CSV): ${orgRole}` : null,
    emailHrNote,
  ]);

  return {
    lineNumber,
    full_name,
    email: dedupeEmail,
    contact_email: contactEmail,
    csv_email_raw,
    passwordFromCsv,
    company_id: company_id ?? "",
    company_label: effectiveCompanyLabel,
    phone: cell(row, col, "phone") || null,
    job_title: cell(row, col, "job_title") || null,
    national_id,
    hired_at,
    date_of_birth,
    gender: mapGender(cell(row, col, "gender")),
    nationality: cell(row, col, "nationality") || null,
    address: cell(row, col, "address") || null,
    department: cell(row, col, "department") || null,
    contract_type,
    contract_end_date,
    passport_number: cell(row, col, "passport_number") || null,
    blood_type,
    education_level,
    emergency_contact_name: cell(row, col, "emergency_contact_name") || null,
    emergency_contact_phone: cell(row, col, "emergency_contact_phone") || null,
    emergency_contact_relationship: cell(row, col, "emergency_contact_relationship") || null,
    hr_notes,
    is_active: mapActiveStatus(cell(row, col, "status")),
    skipReasons,
    warnings,
  };
}

async function fetchAllCompanies(admin: SupabaseClient): Promise<CompanyRow[]> {
  const { data, error } = await admin
    .from("companies")
    .select("id, name_ar, name_en, slug")
    .order("display_order", { ascending: true })
    .order("name_ar", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyRow[];
}

async function collectExistingEmails(admin: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (u.email) emails.add(u.email.toLowerCase().trim());
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return emails;
}

async function collectDirectoryDedupeKeys(admin: SupabaseClient): Promise<{
  byEmail: Set<string>;
  byNational: Set<string>;
}> {
  const byEmail = new Set<string>();
  const byNational = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await admin
      .from("employee_directory")
      .select("company_id, contact_email, national_id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const ce = row.contact_email;
      if (ce && typeof ce === "string")
        byEmail.add(`${row.company_id}\t${ce.toLowerCase().trim()}`);
      const nid = row.national_id;
      if (nid && String(nid).trim())
        byNational.add(`${row.company_id}\t${String(nid).trim()}`);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return { byEmail, byNational };
}

async function collectProfileNationalKeys(admin: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await admin
      .from("profiles")
      .select("company_id, national_id")
      .in("role", ["employee", "company_manager"])
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const nid = row.national_id;
      if (nid && String(nid).trim() && row.company_id)
        out.add(`${row.company_id}\t${String(nid).trim()}`);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function parseArgs(argv: string[]) {
  const out: {
    dryRun: boolean;
    apply: boolean;
    listCompanies: boolean;
    csvPath: string | null;
    companyMapPath: string | null;
    reportOut: string | null;
  } = {
    dryRun: false,
    apply: false,
    listCompanies: false,
    csvPath: null,
    companyMapPath: null,
    reportOut: null,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--apply") out.apply = true;
    else if (a === "--list-companies") out.listCompanies = true;
    else if (a.startsWith("--csv=")) out.csvPath = a.slice("--csv=".length);
    else if (a.startsWith("--company-map=")) out.companyMapPath = a.slice("--company-map=".length);
    else if (a.startsWith("--report-out=")) out.reportOut = a.slice("--report-out=".length);
  }
  return out;
}

function loadCompanyMap(path: string | null): Record<string, string> {
  if (!path) return {};
  const p = resolve(path);
  if (!existsSync(p)) throw new Error(`Company map not found: ${p}`);
  const j = JSON.parse(readFileSync(p, "utf8")) as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(j)) {
    if (k.startsWith("_")) continue;
    if (typeof v !== "string") continue;
    out[k.trim()] = v.trim();
  }
  return out;
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (args.listCompanies) {
    const companies = await fetchAllCompanies(admin);
    console.log(JSON.stringify(companies, null, 2));
    return;
  }

  if (!args.csvPath) {
    console.error("Provide --csv=/absolute/or/relative/path.csv");
    process.exit(1);
  }
  if (!args.dryRun && !args.apply) {
    console.error("Provide --dry-run and/or --apply");
    process.exit(1);
  }
  if (args.dryRun && args.apply) {
    console.error("Use only one of --dry-run or --apply");
    process.exit(1);
  }

  const csvFull = resolve(args.csvPath);
  if (!existsSync(csvFull)) {
    console.error(`CSV not found: ${csvFull}`);
    process.exit(1);
  }

  const manualMap = loadCompanyMap(args.companyMapPath);
  const companies = await fetchAllCompanies(admin);
  const [existingEmails, dirKeys, profileNationalKeys] = await Promise.all([
    collectExistingEmails(admin),
    collectDirectoryDedupeKeys(admin),
    collectProfileNationalKeys(admin),
  ]);

  const grid = parseCsv(readFileSync(csvFull, "utf8"));
  if (grid.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }
  const headers = grid[0];
  const col = buildColumnIndex(headers);
  if (col.full_name === undefined) {
    console.error("Could not detect full_name column from headers:", headers.join(" | "));
    process.exit(1);
  }
  if (col.company === undefined) {
    console.warn(
      "Warning: company column not detected from headers; company cells will not carry forward. Check Arabic header for الشركة.",
    );
  }

  let carryCompany = "";
  const prepared: PreparedRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const lineNumber = r + 1;
    const companyCell = cell(row, col, "company").trim();
    if (companyCell) carryCompany = companyCell;
    const effectiveLabel = carryCompany;

    const { id: company_id, note: companyNote } = resolveCompanyId(
      effectiveLabel,
      companies,
      manualMap,
    );

    prepared.push(prepareRow(row, col, lineNumber, effectiveLabel, company_id, companyNote));
  }

  const firstLineByDedupeKey = new Map<string, number>();
  for (const pr of prepared) {
    const prev = firstLineByDedupeKey.get(pr.email);
    if (prev !== undefined) {
      pr.skipReasons.push(`duplicate import key in CSV (first at line ${prev})`);
    } else {
      firstLineByDedupeKey.set(pr.email, pr.lineNumber);
    }
  }

  const firstLineByCompanyNational = new Map<string, number>();
  for (const pr of prepared) {
    if (pr.national_id && String(pr.national_id).trim()) {
      const k = `${pr.company_id}\t${String(pr.national_id).trim()}`;
      const prev = firstLineByCompanyNational.get(k);
      if (prev !== undefined) {
        pr.skipReasons.push(
          `duplicate national_id in CSV for this company (first at line ${prev})`,
        );
      } else {
        firstLineByCompanyNational.set(k, pr.lineNumber);
      }
    }
  }

  for (const pr of prepared) {
    if (pr.contact_email && existingEmails.has(pr.contact_email.toLowerCase().trim())) {
      pr.skipReasons.push("contact_email already exists in Supabase Auth");
    }
  }

  for (const pr of prepared) {
    if (pr.contact_email) {
      const k = `${pr.company_id}\t${pr.contact_email.toLowerCase().trim()}`;
      if (dirKeys.byEmail.has(k))
        pr.skipReasons.push("contact_email already in employee_directory");
    }
    if (pr.national_id && String(pr.national_id).trim()) {
      const k2 = `${pr.company_id}\t${String(pr.national_id).trim()}`;
      if (dirKeys.byNational.has(k2))
        pr.skipReasons.push("national_id already in employee_directory for this company");
      if (profileNationalKeys.has(k2))
        pr.skipReasons.push("national_id already has a portal profile for this company");
    }
  }

  const toImport = prepared.filter((p) => p.skipReasons.length === 0);
  const skipped = prepared.filter((p) => p.skipReasons.length > 0);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath =
    args.reportOut ?? resolve(process.cwd(), `import-employees-report-${stamp}.txt`);

  const lines: string[] = [];
  lines.push(`CSV: ${csvFull}`);
  lines.push(`Companies in DB: ${companies.length}`);
  lines.push(`Rows in file (excl. header): ${prepared.length}`);
  lines.push(`Ready to import: ${toImport.length}`);
  lines.push(`Skipped: ${skipped.length}`);
  lines.push("");
  if (skipped.length) {
    lines.push("--- SKIPPED ---");
    for (const s of skipped) {
      lines.push(
        `Line ${s.lineNumber} | ${s.full_name || "(no name)"} | contact_email: ${s.contact_email ?? "—"} | dedupe: ${s.email}` +
          (s.csv_email_raw ? ` | CSV email cell: ${s.csv_email_raw}` : ""),
      );
      lines.push(`  company: ${s.company_label}`);
      lines.push(`  reasons: ${s.skipReasons.join("; ")}`);
      if (s.warnings.length) lines.push(`  warnings: ${s.warnings.join("; ")}`);
    }
    lines.push("");
  }
  if (toImport.length) {
    lines.push("--- TO IMPORT ---");
    for (const t of toImport) {
      lines.push(
        `Line ${t.lineNumber} | ${t.full_name} | contact_email: ${t.contact_email ?? "—"} | dedupe: ${t.email}` +
          (t.csv_email_raw ? ` | CSV email cell: ${t.csv_email_raw}` : "") +
          ` | company: ${t.company_label}`,
      );
      if (t.warnings.length) lines.push(`  warnings: ${t.warnings.join("; ")}`);
    }
  }

  const reportBody = lines.join("\n");
  writeFileSync(reportPath, reportBody, "utf8");
  console.log(reportBody);
  console.log(`\nReport written: ${reportPath}`);

  if (args.dryRun) return;

  // --apply: insert HR rows only (employee_directory)
  let ok = 0;
  let fail = 0;

  for (const t of toImport) {
    const { data: inserted, error: insErr } = await admin
      .from("employee_directory")
      .insert({
        company_id: t.company_id,
        full_name: t.full_name,
        contact_email: t.contact_email,
        phone: t.phone,
        job_title: t.job_title,
        national_id: t.national_id,
        hired_at: t.hired_at,
        date_of_birth: t.date_of_birth,
        gender: t.gender,
        nationality: t.nationality,
        address: t.address,
        department: t.department,
        contract_type: t.contract_type,
        contract_end_date: t.contract_end_date,
        passport_number: t.passport_number,
        blood_type: t.blood_type,
        education_level: t.education_level,
        emergency_contact_name: t.emergency_contact_name,
        emergency_contact_phone: t.emergency_contact_phone,
        emergency_contact_relationship: t.emergency_contact_relationship,
        hr_notes: t.hr_notes,
        is_active: t.is_active,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !inserted?.id) {
      fail++;
      const msg = insErr?.message ?? "insert failed";
      appendFileSync(reportPath, `\nFAIL line ${t.lineNumber}: ${msg}\n`);
      console.error(`FAIL line ${t.lineNumber}: ${msg}`);
      continue;
    }

    const companyRow = companies.find((c) => c.id === t.company_id);
    const company_name = companyRow?.name_ar ?? null;
    await admin.from("audit_log").insert({
      actor_id: null,
      action: "employee_directory.import_csv",
      entity: "employee_directory",
      entity_id: inserted.id,
      payload: {
        ...(t.contact_email ? { contact_email: t.contact_email } : {}),
        ...(t.csv_email_raw ? { csv_email_cell: t.csv_email_raw } : {}),
        ...(company_name ? { company_name } : {}),
      },
    });

    ok++;
  }

  appendFileSync(
    reportPath,
    `\n--- APPLY DONE ---\nok: ${ok}\nfailed: ${fail}\n`,
    "utf8",
  );
  console.log(`\nApply finished. ok=${ok} failed=${fail} (employee_directory, no Auth users)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
