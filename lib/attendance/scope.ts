import "server-only";

import { pickDefaultAttendanceCompanyId } from "@/lib/attendance/defaults";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import type { AttendanceBranch, Company, Profile } from "@/types/db";

export function attendanceShowCompanyPicker(
  profile: Pick<Profile, "role" | "is_super_admin">,
): boolean {
  return profile.is_super_admin || profile.role === "md_admin";
}

/** Single source of truth for which company attendance pages/actions use. */
export async function resolveAttendanceCompanyId(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  requestedCompanyId: string | null | undefined,
  companies: Pick<Company, "id">[],
): Promise<string | null> {
  let companyId =
    requestedCompanyId ??
    profile.company_id ??
    pickDefaultAttendanceCompanyId(companies);

  if (profile.role === "md_admin" && !profile.is_super_admin) {
    companyId = (await getShellCompanyIdForProfile(profile)) ?? companyId;
  }
  if (profile.role === "company_manager" && profile.company_id) {
    companyId = profile.company_id;
  }

  return companyId;
}

/** Validates branchId against branches, or picks first active / first branch. */
export function resolveAttendanceBranchId(
  requestedBranchId: string | null | undefined,
  branches: Pick<AttendanceBranch, "id" | "active">[],
  options?: { autoDefault?: boolean },
): string | null {
  if (
    requestedBranchId &&
    branches.some((branch) => branch.id === requestedBranchId)
  ) {
    return requestedBranchId;
  }

  if (options?.autoDefault === false) {
    return null;
  }

  return branches.find((branch) => branch.active)?.id ?? branches[0]?.id ?? null;
}

export async function assertAttendanceCompanyAccess(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
  companyId: string,
): Promise<{ ok: true } | { error: string }> {
  if (profile.is_super_admin) return { ok: true };

  if (profile.role === "company_manager") {
    if (!profile.company_id || profile.company_id !== companyId) {
      return { error: "صلاحيات غير كافية" };
    }
    return { ok: true };
  }

  if (profile.role === "md_admin") {
    const shellId = await getShellCompanyIdForProfile(profile);
    if (shellId && shellId !== companyId) {
      return { error: "صلاحيات غير كافية لهذه الشركة" };
    }
    return { ok: true };
  }

  return { error: "صلاحيات غير كافية" };
}

export async function assertBranchBelongsToCompany(
  companyId: string,
  branchId: string,
): Promise<AttendanceBranch | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: branch } = await supabase
    .from("attendance_branches")
    .select("*")
    .eq("id", branchId)
    .eq("company_id", companyId)
    .maybeSingle<AttendanceBranch>();

  if (!branch) {
    return { error: "الفرع غير موجود أو لا ينتمي لهذه الشركة" };
  }
  return branch;
}

export async function requireSuperAdmin(
  isSuperAdmin: boolean,
): Promise<{ ok: true } | { error: string }> {
  if (!isSuperAdmin) {
    return { error: "هذه العملية متاحة لمدير النظام فقط" };
  }
  return { ok: true };
}
