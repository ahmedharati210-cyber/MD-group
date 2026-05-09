"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean };

const mapSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  description: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  drive_url: z.string().url("رابط غير صالح"),
});

async function resolveCompanyId(profile: { role: string; company_id: string | null }): Promise<string | null> {
  if (profile.company_id) return profile.company_id;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("companies").select("id").contains("enabled_features", ["maps"]).limit(1).single();
  return data?.id ?? null;
}

export async function createMapAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId, profile } = await requireRole(["md_admin", "company_manager"]);
  const parsed = mapSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    project_id: formData.get("project_id") || null,
    drive_url: formData.get("drive_url"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const company_id = await resolveCompanyId(profile);
  if (!company_id) return { error: "لم يتم العثور على الشركة" };

  const supabase = await createSupabaseServerClient();
  const { data: newMap, error } = await supabase
    .from("map_links")
    .insert({ company_id, created_by: userId, ...parsed.data })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: error.message };

  void logAudit(userId, "create", "map", newMap?.id, { name: parsed.data.name });

  revalidatePath("/portal/maps");
  revalidateTag("maps", "default");
  redirect("/portal/maps");
}

export async function updateMapAction(
  id: string,
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const parsed = mapSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    project_id: formData.get("project_id") || null,
    drive_url: formData.get("drive_url"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("map_links").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "update", "map", id, { name: parsed.data.name });

  revalidatePath("/portal/maps");
  revalidateTag("maps", "default");
  redirect("/portal/maps");
}

export async function deleteMapAction(id: string): Promise<ActionState> {
  const { userId } = await requireRole(["md_admin", "company_manager"]);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("map_links").delete().eq("id", id);
  if (error) return { error: error.message };

  void logAudit(userId, "delete", "map", id);

  revalidatePath("/portal/maps");
  revalidateTag("maps", "default");
  return { ok: true };
}
