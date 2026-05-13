import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole, WarningKind } from "@/types/db";

export type BadgeCounts = {
  pendingRequests: number;
  /** Unread rows with kind = warning (sidebar badge prefers red when > 0) */
  unreadWarningAlerts: number;
  /** Unread rows with kind = notification (sidebar orange when warnings = 0) */
  unreadNotificationAlerts: number;
  pendingSignupRequests: number;
  /** Papers with expires_on in the last month before expiry (not yet expired); RLS-scoped */
  expiringPapers: number;
};

async function countUnreadWarningsForKind(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  isEmployee: boolean;
  companyId: string | null;
  isSuperAdmin: boolean;
  kind: WarningKind;
}): Promise<number> {
  const { supabase, userId, isEmployee, companyId, isSuperAdmin, kind } = params;

  let q = supabase
    .from("warnings")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .eq("kind", kind);

  if (isEmployee) {
    const { count } = await q.or(
      `target_profile_id.eq.${userId},target_profile_id.is.null`,
    );
    return count ?? 0;
  }

  if (isSuperAdmin) {
    const { count } = await q;
    return count ?? 0;
  }

  if (companyId) {
    const { count } = await q.eq("company_id", companyId);
    return count ?? 0;
  }

  return 0;
}

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
  /** From layout: `canAccessDolceEmployeeSignup` (respects employee_signup for md_admin). */
  includeDolceSignupBadges: boolean;
}): Promise<BadgeCounts> {
  const supabase = await createSupabaseServerClient();

  const canSeeDolceSignupBadge =
    !!params.dolceSignupCompanyId &&
    !params.isEmployee &&
    params.includeDolceSignupBadges;

  const pendingSignupPromise = (async (): Promise<number> => {
    if (!canSeeDolceSignupBadge || !params.dolceSignupCompanyId) return 0;

    const { count } = await supabase
      .from("employee_signup_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("company_id", params.dolceSignupCompanyId);

    return count ?? 0;
  })();

  const countArgs = {
    supabase,
    userId: params.userId,
    isEmployee: params.isEmployee,
    companyId: params.companyId,
    isSuperAdmin: params.isSuperAdmin,
  };

  const [
    pendingResult,
    unreadWarningAlerts,
    unreadNotificationAlerts,
    pendingSignupRequests,
    expiringRpc,
  ] = await Promise.all([
    params.isEmployee
      ? supabase
          .from("engineer_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("requester_id", params.userId)
      : (async () => {
          if (params.role === "md_admin" && !params.companyId) {
            return { count: 0 };
          }
          let q = supabase
            .from("engineer_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending");
          if (!params.isSuperAdmin && params.companyId) {
            q = q.eq("company_id", params.companyId);
          }
          return await q;
        })(),
    countUnreadWarningsForKind({ ...countArgs, kind: "warning" }),
    countUnreadWarningsForKind({ ...countArgs, kind: "notification" }),
    pendingSignupPromise,
    supabase.rpc("count_documents_expiring_soon"),
  ]);

  let expiringPapers = 0;
  if (!expiringRpc.error && expiringRpc.data != null) {
    const raw = expiringRpc.data;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseInt(raw, 10)
          : NaN;
    expiringPapers = Number.isFinite(n) ? n : 0;
  } else if (expiringRpc.error) {
    console.warn(
      "[badges] count_documents_expiring_soon:",
      expiringRpc.error.message,
    );
  }

  return {
    pendingRequests: pendingResult.count ?? 0,
    unreadWarningAlerts,
    unreadNotificationAlerts,
    pendingSignupRequests,
    expiringPapers,
  };
}
