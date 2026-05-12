"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  PORTAL_ACTIVE_COMPANY_COOKIE,
  parseValidCompanyId,
} from "@/lib/portal-active-company";

export type ActiveCompanyState = { ok?: true; error?: string };

/**
 * Persists the MD Group manager's working company (sidebar + scoped lists).
 * Super admins skip; company managers do not use this cookie.
 */
export async function setPortalActiveCompanyAction(
  companyId: string,
): Promise<ActiveCompanyState> {
  const current = await getCurrentUser();
  if (!current) return { error: "غير مصرّح" };

  const { profile } = current;
  if (profile.is_super_admin) return { ok: true };
  if (profile.role !== "md_admin") return { error: "غير مصرّح" };

  const id = parseValidCompanyId(companyId);
  if (!id) return { error: "معرّف شركة غير صالح" };

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("companies")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "الشركة غير موجودة" };

  const jar = await cookies();
  jar.set(PORTAL_ACTIVE_COMPANY_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 60 * 60 * 24 * 90,
  });

  return { ok: true };
}
