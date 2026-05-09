import "server-only";

import { cacheTag, cacheLife } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AppFeature, RoleFeatures } from "@/types/db";

export type CompanyData = {
  name_ar: string;
  enabled_features: AppFeature[] | null;
  role_features: RoleFeatures | null;
};

/**
 * Fetches company name + feature flags for the given company.
 *
 * Uses the service-role (admin) client so the cache key is purely the
 * companyId argument — no auth cookie involved. This makes 'use cache'
 * actually hit on every subsequent request instead of missing because
 * Supabase rotates the access token on each middleware refresh.
 *
 * Safe to use admin client here: the caller (requireUser / requireFeature)
 * has already validated the user's identity and company membership. Company
 * name and feature flags are not user-sensitive data.
 *
 * Revalidated by companies/actions.ts via revalidateTag('company:<id>').
 */
export async function getCompanyData(
  companyId: string,
): Promise<CompanyData | null> {
  "use cache";
  cacheTag("company", `company:${companyId}`);
  cacheLife({ stale: 300, revalidate: 3600 }); // 5 min stale, 1 hr revalidate

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("companies")
    .select("name_ar, enabled_features, role_features")
    .eq("id", companyId)
    .single<CompanyData>();
  return data ?? null;
}
