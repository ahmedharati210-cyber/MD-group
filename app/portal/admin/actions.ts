"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALL_FEATURES } from "@/types/db";
import type { AppFeature, RoleFeatures } from "@/types/db";

export type ActionState = { error?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Company feature flags
// ---------------------------------------------------------------------------

/**
 * Set the enabled features for a company.
 * Passing all features = null (unrestricted). Passing an empty array disables everything.
 */
export async function setCompanyFeaturesAction(
  companyId: string,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const selected = ALL_FEATURES.filter(
    (f) => formData.get(`feature_${f}`) === "on",
  ) as AppFeature[];

  // null means "all enabled" — use null when every feature is checked
  const enabled_features: AppFeature[] | null =
    selected.length === ALL_FEATURES.length ? null : selected;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("companies")
    .update({ enabled_features })
    .eq("id", companyId);

  if (error) return { error: error.message };

  revalidatePath("/portal/admin");
  revalidatePath("/portal");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-role feature visibility
// ---------------------------------------------------------------------------

const roleFeaturesSchema = z.object({
  company_id: z.string().uuid(),
  role: z.enum(["company_manager", "employee"]),
});

/**
 * Set the visible features for a specific role within a company.
 * Selecting all available features resets the override to null (unrestricted).
 */
export async function setRoleFeaturesAction(
  companyId: string,
  role: "company_manager" | "employee",
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = roleFeaturesSchema.safeParse({ company_id: companyId, role });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const selected = ALL_FEATURES.filter(
    (f) => formData.get(`role_feature_${f}`) === "on",
  ) as AppFeature[];

  const supabase = await createSupabaseServerClient();

  // Fetch current role_features to merge
  const { data: company } = await supabase
    .from("companies")
    .select("role_features, enabled_features")
    .eq("id", companyId)
    .single<{ role_features: RoleFeatures | null; enabled_features: AppFeature[] | null }>();

  const current: RoleFeatures = company?.role_features ?? {};
  const enabledFeatures = company?.enabled_features;

  // Determine the effective "all available" set for this company
  const available = enabledFeatures ?? ALL_FEATURES;

  // If the user checked everything that's available, remove the override (null = unrestricted)
  const allAvailableSelected = available.every((f) => selected.includes(f));

  const updated: RoleFeatures = {
    ...current,
    [role]: allAvailableSelected ? undefined : selected,
  };

  // If both keys are undefined, store null
  const role_features: RoleFeatures | null =
    updated.company_manager === undefined && updated.employee === undefined
      ? null
      : updated;

  const { error } = await supabase
    .from("companies")
    .update({ role_features })
    .eq("id", companyId);

  if (error) return { error: error.message };

  revalidatePath("/portal/admin");
  revalidatePath("/portal");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Super admin management
// ---------------------------------------------------------------------------
const superAdminSchema = z.object({
  profile_id: z.string().uuid(),
  grant: z.boolean(),
});

/**
 * Grant or revoke the super_admin flag from an md_admin profile.
 * Only a super admin can do this.
 */
export async function setSuperAdminAction(
  profileId: string,
  grant: boolean,
): Promise<ActionState> {
  const { userId } = await requireSuperAdmin();

  // Prevent revoking your own super admin status
  if (!grant && profileId === userId) {
    return { error: "لا يمكنك إزالة صلاحية super admin من حسابك الخاص" };
  }

  const parsed = superAdminSchema.safeParse({ profile_id: profileId, grant });
  if (!parsed.success) return { error: "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();

  // Only md_admin users can be granted super_admin
  if (grant) {
    const { data: target } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .single();
    if (!target || target.role !== "md_admin") {
      return { error: "يمكن منح صلاحية super admin للمدراء العامين فقط" };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_super_admin: grant })
    .eq("id", profileId);

  if (error) return { error: error.message };

  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// User role management (super admin only)
// ---------------------------------------------------------------------------
const roleSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(["md_admin", "company_manager", "employee"]),
  company_id: z.string().uuid().optional().nullable(),
});

export async function setUserRoleAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireSuperAdmin();

  const parsed = roleSchema.safeParse({
    profile_id: formData.get("profile_id"),
    role: formData.get("role"),
    company_id: formData.get("company_id") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  if (parsed.data.profile_id === userId) {
    return { error: "لا يمكنك تغيير دور حسابك الخاص" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role,
      company_id: parsed.data.company_id ?? null,
      // If demoting from md_admin, remove super_admin flag
      ...(parsed.data.role !== "md_admin" ? { is_super_admin: false } : {}),
    })
    .eq("id", parsed.data.profile_id);

  if (error) return { error: error.message };

  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Full profile update (super admin only)
// ---------------------------------------------------------------------------
const editProfileSchema = z.object({
  profile_id: z.string().uuid(),
  full_name: z.string().min(2, "الاسم مطلوب"),
  role: z.enum(["md_admin", "company_manager", "employee"]),
  company_id: z.string().uuid().optional().nullable(),
  job_title: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export async function editProfileAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireSuperAdmin();

  const parsed = editProfileSchema.safeParse({
    profile_id: formData.get("profile_id"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    company_id: formData.get("company_id") || null,
    job_title: formData.get("job_title") || null,
    is_active: formData.get("is_active") !== "false",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      company_id: parsed.data.company_id ?? null,
      job_title: parsed.data.job_title ?? null,
      is_active: parsed.data.is_active,
      ...(parsed.data.role !== "md_admin" ? { is_super_admin: false } : {}),
    })
    .eq("id", parsed.data.profile_id);

  if (error) return { error: error.message };

  revalidatePath("/portal/admin");
  revalidatePath("/portal/employees");
  return { ok: true };
}
