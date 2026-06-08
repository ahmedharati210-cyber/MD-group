import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
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

const EMPTY_BADGES: BadgeCounts = {
  pendingRequests: 0,
  unreadWarningAlerts: 0,
  unreadNotificationAlerts: 0,
  pendingSignupRequests: 0,
  expiredPapers: 0,
  expiringSoonPapers: 0,
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

function createTokenClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

type BadgeParams = {
  userId: string;
  isEmployee: boolean;
  role: UserRole;
  companyId: string | null;
  isSuperAdmin: boolean;
  /** Dolce employee signup (slug `company-two` / الطريق الصحيح); signup badges scoped to this company */
  dolceSignupCompanyId: string | null;
  /** From layout: `canAccessDolceEmployeeSignup` (respects employee_signup for md_admin). */
  includeDolceSignupBadges: boolean;
};

/**
 * Inner cached fetcher — keyed on stable user identifiers so the
 * Next.js data cache persists across cookie rotations. Access token
 * is passed as a closure rather than a cache key to keep the key stable.
 * Revalidates every 30 s; tags allow instant invalidation on mutations.
 */
function fetchBadgesCached(params: BadgeParams, accessToken: string): Promise<BadgeCounts> {
  const {
    userId,
    isEmployee,
    role,
    companyId,
    isSuperAdmin,
    dolceSignupCompanyId,
    includeDolceSignupBadges,
  } = params;

  return unstable_cache(
    async () => {
      const supabase = createTokenClient(accessToken);

      const canSeeDolceSignupBadge =
        !!dolceSignupCompanyId && !isEmployee && includeDolceSignupBadges;

      const pendingSignupPromise = (async (): Promise<number> => {
        if (!canSeeDolceSignupBadge || !dolceSignupCompanyId) return 0;
        const { count } = await supabase
          .from("employee_signup_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("company_id", dolceSignupCompanyId);
        return count ?? 0;
      })();

      const pendingRequestsPromise = (async (): Promise<number> => {
        if (isEmployee) {
          const { count } = await supabase
            .from("engineer_requests")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("requester_id", userId);
          return count ?? 0;
        }
        // Owner / md_admin without an active company show no badge
        if ((role === "md_admin" || role === "owner") && !companyId) return 0;
        let q = supabase
          .from("engineer_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        if (!isSuperAdmin && companyId) q = q.eq("company_id", companyId);
        const { count } = await q;
        return count ?? 0;
      })();

      // Notification-centre badges: employees (direct + broadcast) or managers (direct only).
      const warningAlertsPromise = (async (): Promise<number> => {
        if (isSuperAdmin || role === "owner") return 0;
        if (isEmployee) {
          const { count } = await supabase
            .from("warnings")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .eq("kind", "warning")
            .or(`target_profile_id.eq.${userId},target_profile_id.is.null`);
          return count ?? 0;
        }
        const { count } = await supabase
          .from("warnings")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .eq("kind", "warning")
          .eq("target_profile_id", userId);
        return count ?? 0;
      })();

      const notificationAlertsPromise = (async (): Promise<number> => {
        if (isSuperAdmin || role === "owner") return 0;
        if (isEmployee) {
          const { count } = await supabase
            .from("warnings")
            .select("id", { count: "exact", head: true })
            .eq("is_read", false)
            .eq("kind", "notification")
            .or(`target_profile_id.eq.${userId},target_profile_id.is.null`);
          return count ?? 0;
        }
        const { count } = await supabase
          .from("warnings")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false)
          .eq("kind", "notification")
          .eq("target_profile_id", userId);
        return count ?? 0;
      })();

      const [
        pendingRequests,
        unreadWarningAlerts,
        unreadNotificationAlerts,
        pendingSignupRequests,
        expiredRpc,
        expiringSoonRpc,
      ] = await Promise.all([
        pendingRequestsPromise,
        warningAlertsPromise,
        notificationAlertsPromise,
        pendingSignupPromise,
        supabase.rpc("count_documents_expired"),
        supabase.rpc("count_documents_expiring_soon"),
      ]);

      if (expiredRpc.error) {
        console.warn("[badges] count_documents_expired:", expiredRpc.error.message);
      }
      if (expiringSoonRpc.error) {
        console.warn("[badges] count_documents_expiring_soon:", expiringSoonRpc.error.message);
      }

      return {
        pendingRequests,
        unreadWarningAlerts,
        unreadNotificationAlerts,
        pendingSignupRequests,
        expiredPapers: parseRpcCount(expiredRpc.data),
        expiringSoonPapers: parseRpcCount(expiringSoonRpc.data),
      };
    },
    // Stable key: does not include the access token (which rotates on every request)
    [`badges-${userId}-${isEmployee ? "emp" : "mgr"}-${isSuperAdmin ? "sa" : "ns"}`],
    { revalidate: 30, tags: ["badges", `badges-user-${userId}`] },
  )();
}

/**
 * Sidebar notification badge counts cached for 30 s per user.
 *
 * Uses an access-token-authenticated client inside unstable_cache to bypass
 * the Supabase cookie-rotation problem (rotating cookies would bust the cache
 * on every request). React.cache() deduplicates within a single render pass.
 *
 * To force immediate refresh after a mutation call:
 *   revalidateTag(`badges-user-${userId}`)  — single user
 *   revalidateTag("badges")                 — all users
 */
export const getBadgeCounts = cache(
  async (params: BadgeParams, accessToken: string): Promise<BadgeCounts> => {
    if (!accessToken) return EMPTY_BADGES;
    return fetchBadgesCached(params, accessToken);
  },
);
