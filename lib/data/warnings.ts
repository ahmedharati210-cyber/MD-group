import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WarningRow = {
  id: string;
  message: string;
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
 */
export async function getWarningsData(params: {
  profileId: string;
  companyId: string | null;
  role: string;
  isSuperAdmin: boolean;
  page: number;
  pageSize: number;
}): Promise<WarningsData> {
  const supabase = await createSupabaseServerClient();
  const isManager = params.role !== "employee";
  const offset = (params.page - 1) * params.pageSize;

  const { data: rawWarnings, count } = await supabase
    .from("warnings")
    .select(
      "id, message, is_read, created_at, target:target_profile_id(full_name), sender:sender_id(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  let engineers: { id: string; full_name: string }[] | null = null;
  let companies: { id: string; name_ar: string }[] | null = null;

  if (isManager) {
    let engQuery = supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "employee")
      .eq("is_active", true)
      .order("full_name");

    if (params.role === "company_manager") {
      engQuery = engQuery.eq("company_id", params.companyId ?? "");
    }

    const [{ data: engData }, companyResult] = await Promise.all([
      engQuery,
      params.isSuperAdmin
        ? supabase.from("companies").select("id, name_ar").order("name_ar")
        : Promise.resolve({ data: null }),
    ]);

    engineers = engData;
    companies = companyResult.data as typeof companies;
  }

  return {
    warnings: (rawWarnings ?? []) as unknown as WarningRow[],
    totalCount: count ?? 0,
    engineers,
    companies,
  };
}
