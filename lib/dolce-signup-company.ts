import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCompanyData } from "@/lib/company";
import { isFeatureEnabled, isMdManagerFeatureAllowed } from "@/lib/features";
import type { AppFeature, Profile } from "@/types/db";

/**
 * Seed company #2 (`0001_init.sql`) — Dolce employee signup is restricted to this company.
 * Display name is updated in migration `0024` to «الطريق الصحيح».
 */
export const DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG = "company-two";

export async function getDolceSignupCompanyId(): Promise<string | null> {
  "use cache";
  cacheTag("dolce-company-id");
  cacheLife({ stale: 3600, revalidate: 86400 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function getDolceSignupCompanyDisplay(): Promise<{
  id: string;
  name_ar: string;
} | null> {
  "use cache";
  cacheTag("dolce-company-display");
  cacheLife({ stale: 3600, revalidate: 86400 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id, name_ar")
    .eq("slug", DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG)
    .maybeSingle<{ id: string; name_ar: string }>();
  return data ?? null;
}

/**
 * Employee signup UI/API: super admin; company managers when their company has
 * `employee_signup` enabled; MD Group managers when their active shell company
 * has `employee_signup` in `enabled_features`.
 *
 * Pass `shellEnabledFeatures` when the shell company row is already loaded
 * (avoids a duplicate `getCompanyData` in the portal layout).
 */
export function resolveDolceEmployeeSignupAccess(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  shellCompanyId?: string | null,
  shellEnabledFeatures?: AppFeature[] | null,
): boolean {
  if (profile.is_super_admin) return true;
  if (profile.role === "md_admin") {
    if (shellCompanyId == null) return false;
    return isMdManagerFeatureAllowed(
      "employee_signup",
      shellEnabledFeatures ?? null,
    );
  }
  if (profile.role === "company_manager") {
    return isFeatureEnabled("employee_signup", shellEnabledFeatures);
  }
  return false;
}

export async function canAccessDolceEmployeeSignup(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  /** Active portal company (cookie for MD Group managers). */
  shellCompanyId?: string | null,
): Promise<boolean> {
  if (profile.is_super_admin) return true;
  if (profile.role === "md_admin") {
    if (shellCompanyId == null) return false;
    const row = await getCompanyData(shellCompanyId);
    return resolveDolceEmployeeSignupAccess(
      profile,
      shellCompanyId,
      row?.enabled_features ?? null,
    );
  }
  if (profile.role === "company_manager" && profile.company_id) {
    const row = await getCompanyData(profile.company_id);
    return resolveDolceEmployeeSignupAccess(
      profile,
      profile.company_id,
      row?.enabled_features ?? null,
    );
  }
  return false;
}
