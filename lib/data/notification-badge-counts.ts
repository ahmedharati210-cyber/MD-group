import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WarningKind } from "@/types/db";

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
  companyId: string | null;
  isSuperAdmin: boolean;
  kind: WarningKind;
}): Promise<number> {
  const { supabase, userId, isEmployee, kind } = params;

  // Inbox badges are for recipients only. Managers/admins send notifications;
  // unread rows in their company are employee inbox state, not admin alerts.
  if (!isEmployee) {
    return 0;
  }

  const { count } = await supabase
    .from("warnings")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .eq("kind", kind)
    .or(`target_profile_id.eq.${userId},target_profile_id.is.null`);

  return count ?? 0;
}

export async function getNotificationBadgeCounts(params: {
  supabase: SupabaseClient;
  userId: string;
  isEmployee: boolean;
  companyId: string | null;
  isSuperAdmin: boolean;
}): Promise<NotificationBadgeCounts> {
  const countArgs = {
    supabase: params.supabase,
    userId: params.userId,
    isEmployee: params.isEmployee,
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
