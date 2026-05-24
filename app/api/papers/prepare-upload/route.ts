import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Step 1 of 3: validate metadata and return a short-lived Supabase signed upload URL.
 * The client then PUTs the file directly to Supabase Storage — bypassing Vercel's
 * 4.5 MB request body limit entirely.
 *
 * Accepts JSON: { company_id, title, file_name, mime_type, file_size }
 * Returns:      { signedUrl, storagePath }
 */
export async function POST(req: NextRequest) {
  const current = await requireRole(["md_admin", "company_manager"]);

  const body = await req.json();
  const { company_id, title, file_name, mime_type, file_size } = body ?? {};

  if (
    typeof company_id !== "string" ||
    typeof title !== "string" ||
    typeof file_name !== "string"
  ) {
    return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
  }

  if (typeof file_size === "number" && file_size > MAX_BYTES) {
    return NextResponse.json(
      { error: "الملف أكبر من الحد المسموح (25MB)" },
      { status: 413 },
    );
  }

  if (mime_type && !ALLOWED_MIME.has(mime_type)) {
    return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 415 });
  }

  if (
    current.profile.role === "company_manager" &&
    current.profile.company_id !== company_id
  ) {
    return NextResponse.json({ error: "صلاحيات غير كافية" }, { status: 403 });
  }

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = file_name.split(".").pop()?.toLowerCase() || "bin";
  const storagePath = `${company_id}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "فشل إنشاء رابط الرفع" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
