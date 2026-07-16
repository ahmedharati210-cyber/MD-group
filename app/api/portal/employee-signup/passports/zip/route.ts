import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireRole } from "@/lib/auth";
import { canAccessDolceEmployeeSignup } from "@/lib/dolce-signup-company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { passportZipEntryFileName } from "@/lib/passport-archive-name";

function missingPassportNoteName(
  fullName: string | null,
  phone: string | null,
  id: string,
  storagePath: string,
): string {
  const base = passportZipEntryFileName(fullName, phone, id, storagePath);
  return `${base.replace(/\.[^.]+$/, "")}_DOWNLOAD_FAILED.txt`;
}

/**
 * ZIP of all passport scans for Dolce signup requests that still have storage paths.
 * Managers download for archival, then call purge to free bucket space.
 */
export async function GET() {
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
    .select("id, full_name, phone, passport_image_path")
    .not("passport_image_path", "is", null);

  if (queryCompanyId) {
    query = query.eq("company_id", queryCompanyId);
  }

  const { data: rows, error: qErr } = await query;

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const list = rows ?? [];
  if (list.length === 0) {
    return NextResponse.json(
      { error: "لا توجد صور جواز مخزّنة حالياً." },
      { status: 404 },
    );
  }

  const zip = new JSZip();

  for (const row of list) {
    const path = row.passport_image_path;
    if (!path) continue;
    const { data: blob, error: dlErr } = await admin.storage
      .from("documents")
      .download(path);
    if (dlErr || !blob) {
      zip.file(
        missingPassportNoteName(
          row.full_name,
          row.phone,
          row.id,
          path,
        ),
        `Could not download: ${path}\n${dlErr?.message ?? ""}`,
      );
      continue;
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    zip.file(
      passportZipEntryFileName(
        row.full_name,
        row.phone,
        row.id,
        path,
      ),
      buf,
    );
  }

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="employee-passports-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
