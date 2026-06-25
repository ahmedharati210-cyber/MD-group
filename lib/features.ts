import type { AppFeature, RoleFeatures, UserRole } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Platform-wide kill switch — clear when a module is ready for production. */
export const PLATFORM_DISABLED_FEATURES: AppFeature[] = ["attendance"];

export function isPlatformFeatureEnabled(feature: AppFeature): boolean {
  return !PLATFORM_DISABLED_FEATURES.includes(feature);
}

export function isAttendanceEnabled(): boolean {
  return isPlatformFeatureEnabled("attendance");
}

function withoutPlatformDisabled(features: AppFeature[]): AppFeature[] {
  return features.filter(isPlatformFeatureEnabled);
}

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
  if (!isPlatformFeatureEnabled(feature)) return false;
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

/** Sync check from company row — null enabled_features means all features on. */
export function isConstructionCompanyByFeatures(
  enabledFeatures: AppFeature[] | null | undefined,
): boolean {
  if (enabledFeatures == null) return true;
  return enabledFeatures.includes("timeline");
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
  warnings: "مركز الإشعارات",
  employee_signup: "طلبات التوظيف (Dolce)",
};

/**
 * Modules always available to MD Group managers (`md_admin`) once an active
 * company shell is set — not driven by `enabled_features` toggles.
 */
export const MD_MANAGER_CORE_FEATURES: AppFeature[] = [
  "warnings",
  "papers",
  "mail",
  "contacts",
];

/**
 * Fixed set of features visible to the `owner` role.
 * Owners always see these modules regardless of company feature flags.
 */
export const OWNER_FEATURES: AppFeature[] = [
  "papers",
  "mail",
  "contacts",
  "timeline",
];

/**
 * Modules Super Admin enables per company; MD Group managers only see these
 * when listed in `companies.enabled_features`. `null`/empty enabled_features
 * means no optional modules for managers (strict), not "all on".
 */
export const MD_MANAGER_PANEL_FEATURES: AppFeature[] = [
  "attendance",
  "timeline",
  "reports",
  "requests",
  "claims",
  "maps",
  "employee_signup",
];

export function isMdManagerFeatureAllowed(
  feature: AppFeature,
  enabledFeatures: AppFeature[] | null,
): boolean {
  if (!isPlatformFeatureEnabled(feature)) return false;
  if (MD_MANAGER_CORE_FEATURES.includes(feature)) return true;
  if (!MD_MANAGER_PANEL_FEATURES.includes(feature)) return false;
  if (enabledFeatures == null || enabledFeatures.length === 0) return false;
  return enabledFeatures.includes(feature);
}

/**
 * Returns the effective set of features visible to a user given:
 * - Their role
 * - Company-wide enabled_features
 * - Per-role role_features overrides
 *
 * md_admin (MD Group managers): core modules always on; optional modules only
 *   if listed in `enabled_features`. `null`/empty = no optional modules.
 *   `role_features` does not apply. Super admins still pass isSuperAdmin=true → unrestricted.
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
  if (isSuperAdmin) return null;

  if (role === "md_admin") {
    if (enabledFeatures == null || enabledFeatures.length === 0) return [];
    return withoutPlatformDisabled(
      enabledFeatures.filter((f) => MD_MANAGER_PANEL_FEATURES.includes(f)),
    );
  }

  // Owners have a fixed feature set — not driven by company feature flags.
  if (role === "owner") return withoutPlatformDisabled(OWNER_FEATURES);

  const roleOverride =
    roleFeatures?.[role as "company_manager" | "employee"];

  if (roleOverride !== undefined) {
    // Intersect role override with the company's enabled features
    if (enabledFeatures === null) {
      return withoutPlatformDisabled(roleOverride);
    }
    return withoutPlatformDisabled(
      roleOverride.filter((f) => enabledFeatures.includes(f)),
    );
  }

  if (enabledFeatures === null) return null;
  return withoutPlatformDisabled(enabledFeatures);
}
