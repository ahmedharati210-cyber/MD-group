import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { UserRole, WarningKind } from "@/types/db";

export type WarningRow = {
  id: string;
  message: string;
  kind: WarningKind;
  is_read: boolean;
  created_at: string;
  target: { full_name: string } | null;
  sender: { full_name: string } | null;
};

export type NotificationRecipient = {
  id: string;
  full_name: string;
  role: UserRole;
};

export type WarningsData = {
  warnings: WarningRow[];
  totalCount: number;
  engineers: { id: string; full_name: string }[] | null;
  managers: NotificationRecipient[] | null;
  companies: { id: string; name_ar: string }[] | null;
};

export type ManagerInboxData = {
  warnings: WarningRow[];
  totalCount: number;
};

/**
 * Warnings list with related engineers/companies for the send-warning form.
 * Fetched per request (no "use cache" — Supabase client reads session cookies).
 * Freshness: revalidatePath from warnings/actions.ts plus client router.refresh on push/focus.
 *
 * `filterCompanyId`: when set, list + engineer picker are scoped to that company.
 * Super admins and MD Group managers may pass null to list warnings across all companies.
 */
export async function getWarningsData(params: {
  profileId: string;
  filterCompanyId: string | null;
  role: string;
  isSuperAdmin: boolean;
  page: number;
  pageSize: number;
}): Promise<WarningsData> {
  const supabase = await createSupabaseServerClient();
  const isManager = params.role !== "employee" && params.role !== "owner";
  const offset = (params.page - 1) * params.pageSize;

  let warningsQuery = supabase
    .from("warnings")
    .select(
      "id, message, kind, is_read, created_at, target:target_profile_id(full_name), sender:sender_id(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  if (params.filterCompanyId && isManager) {
    warningsQuery = warningsQuery.eq("company_id", params.filterCompanyId);
  }

  const { data: rawWarnings, count } = await warningsQuery;

  let engineers: { id: string; full_name: string }[] | null = null;
  let managers: NotificationRecipient[] | null = null;
  let companies: { id: string; name_ar: string }[] | null = null;

  if (isManager) {
    let engQuery = supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "employee")
      .eq("is_active", true)
      .neq("id", params.profileId)
      .order("full_name");

    if (params.filterCompanyId) {
      engQuery = engQuery.eq("company_id", params.filterCompanyId);
    }

    const { data: engData } = await engQuery;
    engineers = engData;

    let mgrQuery = supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .eq("is_super_admin", false)
      .neq("id", params.profileId)
      .order("full_name");

    if (params.role === "company_manager") {
      mgrQuery = mgrQuery.eq("role", "company_manager");
      if (params.filterCompanyId) {
        mgrQuery = mgrQuery.eq("company_id", params.filterCompanyId);
      }
    } else if (params.role === "md_admin") {
      mgrQuery = mgrQuery.in("role", ["company_manager", "md_admin"]);
    } else if (params.isSuperAdmin) {
      mgrQuery = mgrQuery.in("role", ["company_manager", "md_admin"]);
    } else {
      mgrQuery = mgrQuery.eq("role", "company_manager");
    }

    const { data: mgrData } = await mgrQuery;
    managers = (mgrData ?? []) as NotificationRecipient[];

    if (params.isSuperAdmin || params.role === "md_admin" || params.role === "owner") {
      const { data } = await supabase
        .from("companies")
        .select("id, name_ar")
        .order("name_ar");
      companies = data as typeof companies;
    } else if (params.filterCompanyId) {
      const { data } = await supabase
        .from("companies")
        .select("id, name_ar")
        .eq("id", params.filterCompanyId)
        .maybeSingle();
      companies = data ? [data] : [];
    } else {
      companies = [];
    }
  }

  return {
    warnings: (rawWarnings ?? []) as unknown as WarningRow[],
    totalCount: count ?? 0,
    engineers,
    managers,
    companies,
  };
}

/** Personal inbox for managers (rows addressed directly to profileId). */
export async function getManagerInboxData(params: {
  profileId: string;
  page: number;
  pageSize: number;
}): Promise<ManagerInboxData> {
  const supabase = await createSupabaseServerClient();
  const offset = (params.page - 1) * params.pageSize;

  const { data: rawWarnings, count } = await supabase
    .from("warnings")
    .select(
      "id, message, kind, is_read, created_at, target:target_profile_id(full_name), sender:sender_id(full_name)",
      { count: "exact" },
    )
    .eq("target_profile_id", params.profileId)
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  return {
    warnings: (rawWarnings ?? []) as unknown as WarningRow[],
    totalCount: count ?? 0,
  };
}
