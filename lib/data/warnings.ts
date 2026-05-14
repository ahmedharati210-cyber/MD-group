import "server-only";

import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { WarningKind } from "@/types/db";

export type WarningRow = {
  id: string;
  message: string;
  kind: WarningKind;
  is_read: boolean;
  created_at: string;
  target: { full_name: string } | null;
  sender: { full_name: string } | null;
};

export type WarningsData = {
  warnings: WarningRow[];
  totalCount: number;
  engineers: { id: string; full_name: string }[] | null;
  companies: { id: string; name_ar: string }[] | null;
};

/**
 * Warnings list with related engineers/companies for the send-warning form.
 * Short TTL (30s stale) so new warnings are reflected quickly.
 * Revalidated by warnings/actions.ts.
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
  const isManager = params.role !== "employee";
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
  let companies: { id: string; name_ar: string }[] | null = null;

  if (isManager) {
    let engQuery = supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "employee")
      .eq("is_active", true)
      .order("full_name");

    if (params.filterCompanyId) {
      engQuery = engQuery.eq("company_id", params.filterCompanyId);
    }

    const { data: engData } = await engQuery;
    engineers = engData;

    if (params.isSuperAdmin || params.role === "md_admin") {
      companies = await fetchCompaniesForDropdown(supabase);
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
    companies,
  };
}
