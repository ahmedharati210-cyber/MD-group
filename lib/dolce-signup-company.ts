import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCompanyData } from "@/lib/company";
import { isMdManagerFeatureAllowed } from "@/lib/features";
import type { Profile } from "@/types/db";

/**
 * Seed company #2 (`0001_init.sql`) — Dolce employee signup is restricted to this company.
 * Display name is updated in migration `0024` to «الطريق الصحيح».
 */
export const DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG = "company-two";

export const getDolceSignupCompanyId = cache(async (): Promise<string | null> => {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("slug", DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
});

export const getDolceSignupCompanyDisplay = cache(
  async (): Promise<{ id: string; name_ar: string } | null> => {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("companies")
      .select("id, name_ar")
      .eq("slug", DOLCE_EMPLOYEE_SIGNUP_COMPANY_SLUG)
      .maybeSingle<{ id: string; name_ar: string }>();
    return data ?? null;
  },
);

/**
 * Dolce signup UI/API: super admin; company managers of the Dolce company;
 * MD Group managers only when their active shell is Dolce **and** the company
 * has `employee_signup` in `enabled_features`.
 */
export async function canAccessDolceEmployeeSignup(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  dolceCompanyId: string | null,
  /** Active portal company (cookie for MD Group managers). */
  shellCompanyId?: string | null,
): Promise<boolean> {
  if (!dolceCompanyId) return false;
  if (profile.is_super_admin) return true;
  if (profile.role === "md_admin") {
    if (shellCompanyId == null || shellCompanyId !== dolceCompanyId) {
      return false;
    }
    const row = await getCompanyData(shellCompanyId);
    return isMdManagerFeatureAllowed(
      "employee_signup",
      row?.enabled_features ?? null,
    );
  }
  if (
    profile.role === "company_manager" &&
    profile.company_id === dolceCompanyId
  ) {
    return true;
  }
  return false;
}
