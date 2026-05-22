import { connection } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getNotificationBadgeCounts } from "@/lib/data/notification-badge-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  await connection();
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const isEmployee = profile.role === "employee";
  const badgeCompanyId = profile.is_super_admin
    ? null
    : profile.role === "md_admin"
      ? await getShellCompanyIdForProfile(profile)
      : profile.company_id;

  const counts = await getNotificationBadgeCounts({
    supabase,
    userId: profile.id ?? "",
    isEmployee,
    companyId: badgeCompanyId,
    isSuperAdmin: profile.is_super_admin ?? false,
  });

  return NextResponse.json(counts, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
