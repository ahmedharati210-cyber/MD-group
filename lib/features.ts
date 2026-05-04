import type { AppFeature, RoleFeatures, UserRole } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the given feature is enabled for a company.
 * null/undefined enabled_features means ALL features are on (default).
 * Super admins always bypass this check — pass isSuperAdmin=true.
 */
export function isFeatureEnabled(
  feature: AppFeature,
  enabledFeatures: AppFeature[] | null | undefined,
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true;
  if (enabledFeatures == null) return true; // null = all enabled
  return enabledFeatures.includes(feature);
}

/**
 * Returns true if the given company_id belongs to a company that has the
 * `timeline` feature enabled (i.e. Emaar Al Youm / the construction company).
 * md_admin has no company_id; pass their company_id as null → returns false
 * (md_admin should determine this per-contact, not per-profile).
 */
export async function isConstructionCompany(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<boolean> {
  if (!companyId) return false;
  const { data } = await supabase
    .from("companies")
    .select("enabled_features")
    .eq("id", companyId)
    .single<{ enabled_features: AppFeature[] | null }>();
  if (!data) return false;
  // null means all features on → counts as construction company too
  if (data.enabled_features == null) return true;
  return data.enabled_features.includes("timeline");
}

export const featureLabels: Record<AppFeature, string> = {
  attendance: "الحضور والانصراف",
  papers: "الأوراق الرسمية",
  mail: "البريد",
  contacts: "جهات الاتصال",
  timeline: "المشاريع",
  reports: "التقارير",
  requests: "الطلبات",
  claims: "المطالبات",
  maps: "الخرائط",
  warnings: "الإنذارات",
};

/**
 * Returns the effective set of features visible to a user given:
 * - Their role
 * - Company-wide enabled_features
 * - Per-role role_features overrides
 *
 * md_admin always gets null (unrestricted).
 * For company_manager/employee:
 *   - If role_features has an entry for the role, intersect it with enabled_features.
 *   - Otherwise fall back to enabled_features.
 */
export function getVisibleFeatures(
  role: UserRole,
  enabledFeatures: AppFeature[] | null,
  roleFeatures: RoleFeatures | null,
  isSuperAdmin = false,
): AppFeature[] | null {
  if (isSuperAdmin || role === "md_admin") return null;

  const roleOverride =
    roleFeatures?.[role as "company_manager" | "employee"];

  if (roleOverride !== undefined) {
    // Intersect role override with the company's enabled features
    if (enabledFeatures === null) return roleOverride;
    return roleOverride.filter((f) => enabledFeatures.includes(f));
  }

  return enabledFeatures;
}
