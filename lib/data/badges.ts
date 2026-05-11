import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

export type BadgeCounts = {
  pendingRequests: number;
  unreadWarnings: number;
  pendingSignupRequests: number;
};

/**
 * Sidebar notification badge counts. Always fetches fresh data per request —
 * 'use cache: private' was removed because it never cached across requests
 * (Supabase cookie rotation changes the key on every middleware refresh).
 *
 * Signature simplified: requestsVisible / warningsVisible removed so the
 * layout can call this in parallel with getCompanyData instead of waiting
 * for it. Badge display is already gated by feature visibility in PortalShell.
 */
export async function getBadgeCounts(params: {
  userId: string;
  isEmployee: boolean;
  role: UserRole;
  companyId: string | null;
  isSuperAdmin: boolean;
  /** Dolce employee signup (slug `company-two` / الطريق الصحيح); signup badges scoped to this company */
  dolceSignupCompanyId: string | null;
}): Promise<BadgeCounts> {
  const supabase = await createSupabaseServerClient();

  const canSeeDolceSignupBadge =
    !!params.dolceSignupCompanyId &&
    !params.isEmployee &&
    (params.isSuperAdmin ||
      params.role === "md_admin" ||
      (params.role === "company_manager" &&
        params.companyId === params.dolceSignupCompanyId));

  const pendingSignupPromise = (async (): Promise<number> => {
    if (!canSeeDolceSignupBadge || !params.dolceSignupCompanyId) return 0;

    const { count } = await supabase
      .from("employee_signup_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("company_id", params.dolceSignupCompanyId);

    return count ?? 0;
  })();

  const [pendingResult, warningsResult, pendingSignupRequests] =
    await Promise.all([
      params.isEmployee
        ? supabase
            .from("engineer_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("requester_id", params.userId)
        : supabase
            .from("engineer_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
      params.isEmployee
        ? supabase
            .from("warnings")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .or(
              `target_profile_id.eq.${params.userId},target_profile_id.is.null`,
            )
        : Promise.resolve({ count: 0 }),
      pendingSignupPromise,
    ]);

  return {
    pendingRequests: pendingResult.count ?? 0,
    unreadWarnings: (warningsResult as { count: number | null }).count ?? 0,
    pendingSignupRequests,
  };
}
