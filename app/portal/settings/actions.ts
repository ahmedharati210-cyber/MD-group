"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
});

export type ActionState = { error?: string; ok?: boolean };

export async function updateSelfAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const { userId } = await requireUser();
  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone") || null,
    job_title: formData.get("job_title") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/portal", "layout");
  return { ok: true };
}
