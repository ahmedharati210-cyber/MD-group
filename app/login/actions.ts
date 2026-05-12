"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PORTAL_ACTIVE_COMPANY_COOKIE } from "@/lib/portal-active-company";

const loginSchema = z.object({
  email: z.string().email({ message: "البريد الإلكتروني غير صالح" }),
  password: z.string().min(6, { message: "كلمة المرور قصيرة جدًا" }),
  redirectTo: z.string().optional(),
});

export type LoginState = {
  error?: string;
  ok?: boolean;
};

export async function loginAction(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "فشل تسجيل الدخول. تحقق من البيانات." };
  }

  revalidatePath("/", "layout");
  redirect(parsed.data.redirectTo || "/portal");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  (await cookies()).set(PORTAL_ACTIVE_COMPANY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
