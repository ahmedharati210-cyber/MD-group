"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";

export async function deletePaperAction(formData: FormData) {
  const current = await requireRole(["md_admin", "company_manager"]);
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createSupabaseServerClient();
  // RLS will limit what this manager can read; admin still sees everything.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_path, company_id")
    .eq("id", id)
    .single<{ id: string; storage_path: string; company_id: string }>();

  if (!doc) {
    redirect(`/portal/papers?error=${encodeURIComponent("الملف غير موجود")}`);
  }

  if (
    current.profile.role === "company_manager" &&
    doc.company_id !== current.profile.company_id
  ) {
    redirect(
      `/portal/papers/${id}?error=${encodeURIComponent("صلاحيات غير كافية")}`,
    );
  }

  const admin = createSupabaseAdminClient();

  if (doc.storage_path) {
    await admin.storage.from("documents").remove([doc.storage_path]);
  }

  const { error } = await admin.from("documents").delete().eq("id", id);
  if (error) {
    redirect(
      `/portal/papers/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_id: current.userId,
    action: "document.delete",
    entity: "documents",
    entity_id: id,
  });

  revalidatePath("/portal/papers");
  revalidateTag("papers", "default");
  revalidateTag("dashboard", "default");
  redirect("/portal/papers");
}
