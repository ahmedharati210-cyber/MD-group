import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  canAccessDolceEmployeeSignup,
  getDolceSignupCompanyId,
} from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Redirects to a short-lived signed URL for this signup request's passport scan.
 * Same access rules as the signup-requests page (Dolce company managers / md_admin).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ requestId: string }> },
) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const dolceId = await getDolceSignupCompanyId();
  const shellId = await getShellCompanyIdForProfile(current.profile);
  if (
    !dolceId ||
    !(await canAccessDolceEmployeeSignup(current.profile, dolceId, shellId))
  ) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const { requestId } = await ctx.params;
  const admin = createSupabaseAdminClient();
  const { data: row, error: qErr } = await admin
    .from("employee_signup_requests")
    .select("company_id, passport_image_path")
    .eq("id", requestId)
    .maybeSingle<{
      company_id: string;
      passport_image_path: string | null;
    }>();

  if (qErr || !row || row.company_id !== dolceId || !row.passport_image_path) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("documents")
    .createSignedUrl(row.passport_image_path, 60 * 5);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "فشل إنشاء الرابط" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
