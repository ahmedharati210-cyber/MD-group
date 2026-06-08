"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { profileCacheTag, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function changePasswordAction(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const newPassword = (formData.get("new_password") as string) ?? "";
  const confirmPassword = (formData.get("confirm_password") as string) ?? "";

  if (newPassword.length < 6)
    return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  if (newPassword !== confirmPassword)
    return { error: "كلمتا المرور غير متطابقتين" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { ok: true };
}

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

  revalidateTag(profileCacheTag(userId), "default");
  revalidatePath("/portal", "layout");
  return { ok: true };
}
