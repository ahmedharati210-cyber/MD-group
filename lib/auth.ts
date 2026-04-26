import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";

/**
 * Returns the current auth user + their `profiles` row, or null if signed out.
 * Prefer `requireUser()` or `requireRole()` in protected server components.
 */
export async function getCurrentUser(): Promise<{
  userId: string;
  profile: Profile;
} | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, profile };
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

export async function requireRole(
  allowed: Profile["role"] | Profile["role"][],
) {
  const current = await requireUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(current.profile.role)) {
    redirect("/portal");
  }
  return current;
}
