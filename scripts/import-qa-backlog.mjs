/**
 * One-shot import of Sales Platform pre-production backlog into a QA project.
 *
 * Usage:
 *   node scripts/import-qa-backlog.mjs [projectId]
 *
 * Default project: منظومة المبيعات الشاملة
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_PROJECT_ID = "be45e3ae-5731-4dc9-9d7f-b33592ecba18";

const CATEGORY_TO_SECTION = {
  Sales: "المبيعات",
  Purchases: "المشتريات",
  Inventory: "المخزون",
  Accounting: "المحاسبة",
  "Reports and Printing": "التقارير وطباعتهم",
  "Platform / Pilot": "المنصة / الطيار",
};

function loadEnvLocal() {
  const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",");
  if (!header || header[0] !== "category") {
    throw new Error("Unexpected CSV header");
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // category,tag,title — title may contain commas; split only first two commas
    const first = line.indexOf(",");
    const second = line.indexOf(",", first + 1);
    if (first < 0 || second < 0) {
      throw new Error(`Bad CSV line ${i + 1}: ${line}`);
    }
    const category = line.slice(0, first).trim();
    const tag = line.slice(first + 1, second).trim();
    const title = line.slice(second + 1).trim();
    if (!category || !tag || !title) {
      throw new Error(`Incomplete CSV line ${i + 1}`);
    }
    rows.push({ category, tag, title });
  }
  return rows;
}

async function main() {
  loadEnvLocal();
  const projectId = process.argv[2] || DEFAULT_PROJECT_ID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const csvPath = resolve(ROOT, "scripts/data/pre-production-backlog-import.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Loaded ${rows.length} backlog rows for project ${projectId}`);

  const { data: project, error: projectError } = await supabase
    .from("qa_projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error(`Project not found: ${projectId}`);
  console.log(`Project: ${project.name}`);

  const { data: existingSections, error: secError } = await supabase
    .from("qa_sections")
    .select("id, name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order");
  if (secError) throw secError;

  const sectionByName = new Map(
    (existingSections ?? []).map((s) => [s.name, s]),
  );
  let nextSectionOrder =
    (existingSections ?? []).reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;

  const neededNames = [...new Set(Object.values(CATEGORY_TO_SECTION))];
  for (const name of neededNames) {
    if (sectionByName.has(name)) continue;
    const { data: created, error } = await supabase
      .from("qa_sections")
      .insert({
        project_id: projectId,
        name,
        sort_order: nextSectionOrder++,
      })
      .select("id, name, sort_order")
      .single();
    if (error) throw error;
    sectionByName.set(created.name, created);
    console.log(`Created section: ${created.name}`);
  }

  const { data: existingItems, error: itemsError } = await supabase
    .from("qa_test_items")
    .select("id, section_id, title, sort_order")
    .eq("project_id", projectId);
  if (itemsError) throw itemsError;

  const titlesBySection = new Map();
  const maxOrderBySection = new Map();
  for (const item of existingItems ?? []) {
    const set = titlesBySection.get(item.section_id) ?? new Set();
    set.add(item.title);
    titlesBySection.set(item.section_id, set);
    const prev = maxOrderBySection.get(item.section_id) ?? -1;
    maxOrderBySection.set(item.section_id, Math.max(prev, item.sort_order));
  }

  const toInsert = [];
  let skipped = 0;
  for (const row of rows) {
    const sectionName = CATEGORY_TO_SECTION[row.category];
    if (!sectionName) {
      throw new Error(`Unknown category: ${row.category}`);
    }
    const section = sectionByName.get(sectionName);
    if (!section) throw new Error(`Section missing: ${sectionName}`);

    const title = `[${row.tag}] ${row.title}`;
    const existing = titlesBySection.get(section.id) ?? new Set();
    if (existing.has(title)) {
      skipped += 1;
      continue;
    }
    existing.add(title);
    titlesBySection.set(section.id, existing);

    const nextOrder = (maxOrderBySection.get(section.id) ?? -1) + 1;
    maxOrderBySection.set(section.id, nextOrder);

    toInsert.push({
      section_id: section.id,
      project_id: projectId,
      title,
      description: `${row.tag} · ${row.category}`,
      item_kind: "task",
      sort_order: nextOrder,
    });
  }

  if (toInsert.length === 0) {
    console.log(`Nothing to insert (skipped ${skipped} existing titles).`);
    return;
  }

  const { error: insertError } = await supabase
    .from("qa_test_items")
    .insert(toInsert);
  if (insertError) throw insertError;

  console.log(`Inserted ${toInsert.length} tasks (skipped ${skipped}).`);

  // Summary per section
  const counts = new Map();
  for (const row of toInsert) {
    const name = [...sectionByName.values()].find((s) => s.id === row.section_id)
      ?.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  for (const [name, n] of counts) {
    console.log(`  ${name}: +${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
