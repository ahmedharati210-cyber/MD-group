import "server-only";

import { cacheTag, cacheLife } from "next/cache";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import type { Company } from "@/types/db";

export type CompanyWithCount = Company & { employeeCount: number };

export type FilterCompanyOption = { id: string; name_ar: string };

/** Compact company list for md_admin / owner / super-admin filter dropdowns. */
export async function getFilterCompanies(): Promise<FilterCompanyOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");
  return (data ?? []) as FilterCompanyOption[];
}

/**
 * All companies with per-company employee counts.
 * Uses admin client so the cache key is argument-only (no auth cookie) and
 * 'use cache' actually persists between requests.
 * Admin-only page — no RLS restriction needed.
 * Revalidated by companies/actions.ts.
 */
export async function getCompaniesWithCounts(): Promise<CompanyWithCount[]> {
  "use cache";
  cacheTag("companies");
  cacheLife({ stale: 60, revalidate: 300 });

  const supabase = createSupabaseAdminClient();

  const [{ data: companies }, { data: employees }] = await Promise.all([
    supabase
      .from("companies")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name_ar", { ascending: true }),
    supabase.from("profiles").select("company_id").eq("role", "employee"),
  ]);

  const rows = (companies ?? []) as Company[];
  const empMap = new Map<string, number>();
  for (const r of employees ?? []) {
    if (r.company_id) {
      empMap.set(r.company_id, (empMap.get(r.company_id) ?? 0) + 1);
    }
  }

  return rows.map((c) => ({ ...c, employeeCount: empMap.get(c.id) ?? 0 }));
}
