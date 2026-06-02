import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countUnreadWarningsForKind } from "@/lib/data/notification-badge-counts";
import type { UserRole } from "@/types/db";

export type BadgeCounts = {
  pendingRequests: number;
  /** Unread rows with kind = warning — sidebar red badge on مركز الإشعارات */
  unreadWarningAlerts: number;
  /** Unread rows with kind = notification — sidebar orange badge on مركز الإشعارات */
  unreadNotificationAlerts: number;
  pendingSignupRequests: number;
  /** Papers past expires_on; RLS-scoped */
  expiredPapers: number;
  /** Papers in the final month before expiry (not yet expired); RLS-scoped */
  expiringSoonPapers: number;
};

function parseRpcCount(data: unknown): number {
  if (data == null) return 0;
  const n =
    typeof data === "number"
      ? data
      : typeof data === "string"
        ? parseInt(data, 10)
        : NaN;
  return Number.isFinite(n) ? n : 0;
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
    expiredRpc,
    expiringSoonRpc,
  ] = await Promise.all([
    params.isEmployee
      ? supabase
          .from("engineer_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("requester_id", params.userId)
      : (async () => {
          // Owner and md_admin without an active company show no badge
          if ((params.role === "md_admin" || params.role === "owner") && !params.companyId) {
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
    supabase.rpc("count_documents_expired"),
    supabase.rpc("count_documents_expiring_soon"),
  ]);

  if (expiredRpc.error) {
    console.warn("[badges] count_documents_expired:", expiredRpc.error.message);
  }
  if (expiringSoonRpc.error) {
    console.warn(
      "[badges] count_documents_expiring_soon:",
      expiringSoonRpc.error.message,
    );
  }

  return {
    pendingRequests: pendingResult.count ?? 0,
    unreadWarningAlerts,
    unreadNotificationAlerts,
    pendingSignupRequests,
    expiredPapers: parseRpcCount(expiredRpc.data),
    expiringSoonPapers: parseRpcCount(expiringSoonRpc.data),
  };
}
