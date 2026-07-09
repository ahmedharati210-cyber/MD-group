import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AttendanceBranch } from "@/types/db";

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
