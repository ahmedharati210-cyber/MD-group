import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Accepts multipart/form-data:
 *   file (File), company_id (uuid), title (string), category (enum),
 *   owner_profile_id (uuid, optional)
 *
 * - Uploads the binary to the `documents` bucket
 * - Extracts PDF text (best-effort) and stores in `documents.content_text`
 * - Creates the metadata row (RLS enforced via the user's session)
 */
export async function POST(req: NextRequest) {
  const current = await requireRole(["md_admin", "company_manager"]);

  const form = await req.formData();
  const file = form.get("file");
  const company_id = form.get("company_id");
  const title = form.get("title");
  const category = form.get("category") ?? "other";
  const owner_profile_id = form.get("owner_profile_id");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ملف مطلوب" }, { status: 400 });
  }
  if (typeof company_id !== "string" || typeof title !== "string") {
    return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "الملف أكبر من الحد المسموح (25MB)" },
      { status: 413 },
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "نوع الملف غير مدعوم" },
      { status: 415 },
    );
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
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const key = `${company_id}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  // Best-effort PDF text extraction for full-text search.
  let content_text: string | null = null;
  if (file.type === "application/pdf") {
    try {
      // Dynamic import keeps this out of the edge bundle.
      const mod = (await import("pdf-parse")) as unknown as {
        default?: (b: Buffer) => Promise<{ text: string }>;
      };
      const pdfParse =
        mod.default ??
        (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const result = await pdfParse(buffer);
      content_text = result.text?.slice(0, 200_000) ?? null;
    } catch (err) {
      console.warn("pdf-parse failed; indexing title only", err);
    }
  } else if (file.type === "text/plain") {
    content_text = buffer.toString("utf8").slice(0, 200_000);
  }

  // Upload the binary via the admin client (bucket is private).
  const admin = createSupabaseAdminClient();
  const { error: upErr } = await admin.storage
    .from("documents")
    .upload(key, buffer, { contentType: file.type, upsert: false });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Insert metadata using the user's scoped client so RLS verifies tenancy.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id,
      owner_profile_id:
        typeof owner_profile_id === "string" && owner_profile_id
          ? owner_profile_id
          : null,
      title,
      category: category as
        | "letter"
        | "contract"
        | "memo"
        | "personal"
        | "other",
      storage_path: key,
      mime_type: file.type,
      size_bytes: file.size,
      content_text,
      created_by: current.userId,
    })
    .select()
    .single();

  if (error) {
    // Roll back the storage upload if metadata insert failed.
    await admin.storage.from("documents").remove([key]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "document.create",
    entity: "documents",
    entity_id: data.id,
    payload: { title, category, size_bytes: file.size },
  });

  return NextResponse.json({ id: data.id });
}
