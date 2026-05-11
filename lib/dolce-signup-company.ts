import "server-only";

import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
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

/** Managers other than الطريق الصحيح cannot create invites or review Dolce signup requests. */
export function canAccessDolceEmployeeSignup(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  dolceCompanyId: string | null,
): boolean {
  if (!dolceCompanyId) return false;
  if (profile.is_super_admin || profile.role === "md_admin") return true;
  if (
    profile.role === "company_manager" &&
    profile.company_id === dolceCompanyId
  ) {
    return true;
  }
  return false;
}
