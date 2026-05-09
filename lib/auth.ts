import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVisibleFeatures } from "@/lib/features";
import { getCompanyData } from "@/lib/company";
import type { AppFeature, Profile } from "@/types/db";

// Fields needed by auth guards + portal shell + settings page.
// HR-specific fields (date_of_birth, emergency_contact_*, etc.) are fetched
// on-demand by the employee detail / edit pages via their own queries.
const PROFILE_SELECT =
  "id, full_name, phone, role, company_id, job_title, national_id, hired_at, is_active, avatar_url, is_super_admin, created_at";

/**
 * Returns the current auth user + their `profiles` row, or null if signed out.
 * Wrapped in React `cache()` so duplicate calls within a single render tree
 * (e.g. portal layout + page component) share one DB round-trip.
 * Prefer `requireUser()` or `requireRole()` in protected server components.
 */
export const getCurrentUser = cache(async (): Promise<{
  userId: string;
  profile: Profile;
} | null> => {
  // The middleware (proxy.ts) validates the session via getUser() and injects
  // the verified user ID as x-user-id into request headers before the RSC
  // renders. Reading it here costs ~0ms — no network call, no Supabase warning.
  // Any client-sent x-user-id is deleted by the middleware before it sets its
  // own, so this cannot be spoofed.
  const userId = (await headers()).get("x-user-id");
  if (!userId) return null;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .single();

  if (!profile) return null;
  return { userId, profile: profile as Profile };
});

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

export async function requireRole(
  allowed: Profile["role"] | Profile["role"][],
) {
  const current = await requireUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  // Super admins bypass all role restrictions.
  if (current.profile.is_super_admin) return current;
  if (!roles.includes(current.profile.role)) {
    redirect("/portal");
  }
  return current;
}

/** Guards routes that only the super admin can access. */
export async function requireSuperAdmin() {
  const current = await requireUser();
  if (!current.profile.is_super_admin) {
    redirect("/portal");
  }
  return current;
}

/**
 * Guards feature-gated routes. Redirects to /portal if:
 *  - optional `roles` list is provided and the user's role is not in it, OR
 *  - the feature is disabled for the user's company (respects role_features overrides).
 *
 * Super admins and md_admin always bypass feature checks.
 */
export async function requireFeature(
  feature: AppFeature,
  roles?: Profile["role"][],
) {
  const current = await requireUser();

  if (roles && !current.profile.is_super_admin && !roles.includes(current.profile.role)) {
    redirect("/portal");
  }

  if (current.profile.is_super_admin || current.profile.role === "md_admin") {
    return current;
  }

  if (current.profile.company_id) {
    const companyData = await getCompanyData(current.profile.company_id);
    if (companyData) {
      const visible = getVisibleFeatures(
        current.profile.role,
        companyData.enabled_features,
        companyData.role_features,
      );
      if (visible !== null && !visible.includes(feature)) {
        redirect("/portal");
      }
    }
  }

  return current;
}
