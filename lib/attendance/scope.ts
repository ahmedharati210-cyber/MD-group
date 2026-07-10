import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import type { AttendanceBranch } from "@/types/db";
import type { Profile } from "@/types/db";

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
