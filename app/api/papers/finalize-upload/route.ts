import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

/**
 * Step 3 of 3: save metadata row and extract searchable text.
 *
 * The file is already in Supabase Storage (uploaded directly by the browser
 * in step 2). This route receives only a small JSON payload — no file body —
 * so Vercel's 4.5 MB limit is never reached.
 *
 * For PDFs and plain text the file is downloaded server-to-server (fast,
 * no body limit) so full-text search continues to work.
 *
 * Accepts JSON: {
 *   storage_path, company_id, title, category?, owner_profile_id?,
 *   issued_on?, expires_on?, mime_type?, file_size?
 * }
 * Returns: { id }
 */
export async function POST(req: NextRequest) {
  const current = await requireRole(["md_admin", "company_manager"]);

  const body = await req.json();
  const {
    storage_path,
    company_id,
    title,
    category = "other",
    owner_profile_id,
    issued_on,
    expires_on,
    mime_type,
    file_size,
  } = body ?? {};

  if (
    typeof storage_path !== "string" ||
    typeof company_id !== "string" ||
    typeof title !== "string"
  ) {
    return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
  }

  // Guard against cross-tenant path injection: the storage path must start
  // with the same company_id that will own the documents row. Since
  // prepare-upload generates paths as `{company_id}/{yyyy}/{mm}/{uuid}.{ext}`,
  // any mismatch here means the client tampered with the path.
  if (!storage_path.startsWith(`${company_id}/`)) {
    return NextResponse.json({ error: "مسار الملف غير صالح" }, { status: 400 });
  }

  // Reject path traversal attempts.
  if (storage_path.includes("..") || storage_path.includes("//")) {
    return NextResponse.json({ error: "مسار الملف غير صالح" }, { status: 400 });
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const issuedOn =
    typeof issued_on === "string" && dateRe.test(issued_on) ? issued_on : null;
  const expiresOn =
    typeof expires_on === "string" && dateRe.test(expires_on)
      ? expires_on
      : null;

  if (issuedOn && expiresOn && issuedOn > expiresOn) {
    return NextResponse.json(
      { error: "تاريخ الإصدار يجب أن يكون قبل أو في يوم انتهاء الصلاحية" },
      { status: 400 },
    );
  }

  if (
    current.profile.role === "company_manager" &&
    current.profile.company_id !== company_id
  ) {
    return NextResponse.json({ error: "صلاحيات غير كافية" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  // Download the already-stored file server-to-server for text extraction.
  // This is a server→Supabase call; it never passes through Vercel's request
  // body limit, so it works for any file size up to 25 MB.
  let content_text: string | null = null;
  if (mime_type === "application/pdf" || mime_type === "text/plain") {
    try {
      const { data: blob, error: dlErr } = await admin.storage
        .from("documents")
        .download(storage_path);

      if (!dlErr && blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        if (mime_type === "application/pdf") {
          const mod = (await import("pdf-parse")) as unknown as {
            default?: (b: Buffer) => Promise<{ text: string }>;
          };
          const pdfParse =
            mod.default ??
            (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
          const result = await pdfParse(buffer);
          content_text = result.text?.slice(0, 200_000) ?? null;
        } else {
          content_text = buffer.toString("utf8").slice(0, 200_000);
        }
      }
    } catch (err) {
      console.warn("pdf-parse failed; indexing title only", err);
    }
  }

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
        | "other"
        | "record"
        | "license"
        | "chamber"
        | "statistics_code"
        | "stats_code",
      storage_path,
      mime_type: mime_type ?? null,
      size_bytes: typeof file_size === "number" ? file_size : null,
      content_text,
      created_by: current.userId,
      issued_on: issuedOn,
      expires_on: expiresOn,
    })
    .select()
    .single();

  if (error) {
    // Roll back storage upload if metadata insert fails.
    await admin.storage.from("documents").remove([storage_path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "document.create",
    entity: "documents",
    entity_id: data.id,
    payload: { title, category, size_bytes: file_size },
  });

  return NextResponse.json({ id: data.id });
}
