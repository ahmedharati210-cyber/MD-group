import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

/**
 * Returns a short-lived signed URL for the requested document, but only if
 * the caller's RLS-scoped view of the `documents` table can see that row.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single<{ storage_path: string }>();

  if (error || !data) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data: signed, error: signErr } = await admin.storage
    .from("documents")
    .createSignedUrl(data.storage_path, 300);

  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "فشل" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
