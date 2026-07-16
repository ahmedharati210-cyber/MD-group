import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { canAccessDolceEmployeeSignup } from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Deletes passport images from Supabase Storage and clears paths on signup rows.
 * Run after downloading the ZIP so cloud storage stays lean.
 */
export async function POST() {
  const current = await requireRole(["md_admin", "company_manager"]);
  const shellId = await getShellCompanyIdForProfile(current.profile);
  if (!(await canAccessDolceEmployeeSignup(current.profile, shellId))) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const queryCompanyId =
    current.profile.role === "company_manager"
      ? current.profile.company_id
      : null;

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("employee_signup_requests")
    .select("id, passport_image_path")
    .not("passport_image_path", "is", null);

  if (queryCompanyId) {
    query = query.eq("company_id", queryCompanyId);
  }

  const { data: rows, error: qErr } = await query;

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const paths = (rows ?? [])
    .map((r) => r.passport_image_path)
    .filter((p): p is string => !!p);

  if (paths.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const { error: rmErr } = await admin.storage.from("documents").remove(paths);
  if (rmErr) {
    return NextResponse.json(
      { error: rmErr.message ?? "فشل حذف الملفات من التخزين" },
      { status: 500 },
    );
  }

  let updateQuery = admin
    .from("employee_signup_requests")
    .update({ passport_image_path: null })
    .not("passport_image_path", "is", null);

  if (queryCompanyId) {
    updateQuery = updateQuery.eq("company_id", queryCompanyId);
  }

  const { error: upErr } = await updateQuery;

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  let company_name: string | null = null;
  if (queryCompanyId) {
    const { data: companyRow } = await admin
      .from("companies")
      .select("name")
      .eq("id", queryCompanyId)
      .maybeSingle<{ name: string }>();
    company_name = companyRow?.name ?? null;
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "employee_signup.passport_purge",
    entity: "employee_signup_requests",
    entity_id: null,
    payload: {
      ...(company_name ? { company_name } : {}),
      removed_paths: paths.length,
    },
  });

  return NextResponse.json({ ok: true, deleted: paths.length });
}
