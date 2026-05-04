import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVisibleFeatures } from "@/lib/features";
import type { AppFeature, Profile, RoleFeatures } from "@/types/db";

/**
 * Returns the current auth user + their `profiles` row, or null if signed out.
 * Prefer `requireUser()` or `requireRole()` in protected server components.
 */
export async function getCurrentUser(): Promise<{
  userId: string;
  profile: Profile;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, profile };
}

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
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("companies")
      .select("enabled_features, role_features")
      .eq("id", current.profile.company_id)
      .single<{ enabled_features: AppFeature[] | null; role_features: RoleFeatures | null }>();

    if (data) {
      const visible = getVisibleFeatures(
        current.profile.role,
        data.enabled_features,
        data.role_features,
      );
      if (visible !== null && !visible.includes(feature)) {
        redirect("/portal");
      }
    }
  }

  return current;
}
