import { connection } from "next/server";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getNotificationBadgeCounts } from "@/lib/data/notification-badge-counts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function parseRpcCount(v: unknown): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

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

  const noOp = Promise.resolve({ data: 0, error: null });

  const [counts, expiredRpc, expiringSoonRpc] = await Promise.all([
    getNotificationBadgeCounts({
      supabase,
      userId: profile.id ?? "",
      isEmployee,
      role: profile.role,
      companyId: badgeCompanyId,
      isSuperAdmin: profile.is_super_admin ?? false,
    }),
    isEmployee ? noOp : supabase.rpc("count_documents_expired"),
    isEmployee ? noOp : supabase.rpc("count_documents_expiring_soon"),
  ]);

  const expiredPapers = parseRpcCount(expiredRpc.data);
  const expiringSoonPapers = parseRpcCount(expiringSoonRpc.data);

  return NextResponse.json(
    {
      ...counts,
      expiredPapers,
      expiringSoonPapers,
      total: counts.total + expiredPapers + expiringSoonPapers,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
