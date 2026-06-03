import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole, WarningKind } from "@/types/db";

export type NotificationBadgeCounts = {
  unreadWarnings: number;
  unreadNotifications: number;
  /** Matches sidebar مركز الإشعارات badge (warnings + notifications). */
  total: number;
};

export async function countUnreadWarningsForKind(params: {
  supabase: SupabaseClient;
  userId: string;
  isEmployee: boolean;
  role: UserRole;
  companyId: string | null;
  isSuperAdmin: boolean;
  kind: WarningKind;
}): Promise<number> {
  const { supabase, userId, isEmployee, role, isSuperAdmin, kind } = params;

  // Super admin and owner have no personal inbox.
  if (isSuperAdmin || role === "owner") {
    return 0;
  }

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

  // Managers: only directly addressed rows (no company broadcast).
  const { count } = await q.eq("target_profile_id", userId);
  return count ?? 0;
}

/** Personal inbox unread total (all kinds) for employees and non-super managers. */
export async function countRecipientUnread(params: {
  supabase: SupabaseClient;
  userId: string;
  isEmployee: boolean;
  role: UserRole;
  isSuperAdmin: boolean;
}): Promise<number> {
  const { supabase, userId, isEmployee, role, isSuperAdmin } = params;

  if (isSuperAdmin || role === "owner") {
    return 0;
  }

  let q = supabase
    .from("warnings")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (isEmployee) {
    const { count } = await q.or(
      `target_profile_id.eq.${userId},target_profile_id.is.null`,
    );
    return count ?? 0;
  }

  const { count } = await q.eq("target_profile_id", userId);
  return count ?? 0;
}

export async function getNotificationBadgeCounts(params: {
  supabase: SupabaseClient;
  userId: string;
  isEmployee: boolean;
  role: UserRole;
  companyId: string | null;
  isSuperAdmin: boolean;
}): Promise<NotificationBadgeCounts> {
  const countArgs = {
    supabase: params.supabase,
    userId: params.userId,
    isEmployee: params.isEmployee,
    role: params.role,
    companyId: params.companyId,
    isSuperAdmin: params.isSuperAdmin,
  };

  const [unreadWarnings, unreadNotifications] = await Promise.all([
    countUnreadWarningsForKind({ ...countArgs, kind: "warning" }),
    countUnreadWarningsForKind({ ...countArgs, kind: "notification" }),
  ]);

  return {
    unreadWarnings,
    unreadNotifications,
    total: unreadWarnings + unreadNotifications,
  };
}
