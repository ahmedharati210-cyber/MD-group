import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";

/** Portal company for Al Itqan International — QA testing module. */
export const ITQAN_COMPANY_SLUG = "itqan";

export async function getItqanCompanyId(): Promise<string | null> {
  "use cache";
  cacheTag("itqan-company-id");
  cacheLife({ stale: 3600, revalidate: 86400 });

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("slug", ITQAN_COMPANY_SLUG)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** True when the user may see / use the Al Itqan testing module. */
export function hasTestingAccess(
  profile: Pick<Profile, "is_super_admin" | "testing_access_enabled">,
): boolean {
  return Boolean(profile.is_super_admin || profile.testing_access_enabled);
}

/** Managers (and superadmin) with testing access can create/edit structure. */
export function canManageTesting(
  profile: Pick<Profile, "role" | "is_super_admin" | "testing_access_enabled">,
): boolean {
  if (profile.is_super_admin) return true;
  if (!profile.testing_access_enabled) return false;
  return profile.role === "md_admin" || profile.role === "company_manager";
}
