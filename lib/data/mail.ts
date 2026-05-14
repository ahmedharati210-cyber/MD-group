import "server-only";

import { fetchCompaniesForDropdown } from "@/lib/companies-dropdown";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MailData = {
  mails: unknown[];
  totalCount: number;
  total: number;
  inboundCount: number;
  outboundCount: number;
  companies: { id: string; name_ar: string }[];
};

/**
 * Paginated mail list with tab counts (all/inbound/outbound) and company filter.
 * Tab counts and list data are fetched in a single parallel batch.
 * Revalidated by mail/actions.ts.
 */
export async function getMailData(params: {
  tab: "all" | "inbound" | "outbound";
  filterCompanyId?: string;
  /** When set, company dropdown only includes this company (MD Group manager). */
  scopeCompaniesToId?: string;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<MailData> {
  const supabase = await createSupabaseServerClient();
  const offset = (params.page - 1) * params.pageSize;

  const buildCount = (dir?: "inbound" | "outbound") => {
    let q2 = supabase
      .from("mail")
      .select("id", { count: "exact", head: true });
    if (dir) q2 = q2.eq("direction", dir);
    if (params.filterCompanyId) q2 = q2.eq("company_id", params.filterCompanyId);
    return q2;
  };

  let listQuery = supabase
    .from("mail")
    .select("*, companies(name_ar)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + params.pageSize - 1);

  if (params.tab !== "all") listQuery = listQuery.eq("direction", params.tab);
  if (params.filterCompanyId) listQuery = listQuery.eq("company_id", params.filterCompanyId);
  if (params.q) listQuery = listQuery.ilike("subject", `%${params.q}%`);

  const [
    { count: total },
    { count: inboundCount },
    { count: outboundCount },
    { data: mails, count },
    companies,
  ] = await Promise.all([
    buildCount(),
    buildCount("inbound"),
    buildCount("outbound"),
    listQuery,
    fetchCompaniesForDropdown(supabase, {
      ...(params.scopeCompaniesToId ? { eqId: params.scopeCompaniesToId } : {}),
    }),
  ]);

  return {
    mails: mails ?? [],
    totalCount: count ?? 0,
    total: total ?? 0,
    inboundCount: inboundCount ?? 0,
    outboundCount: outboundCount ?? 0,
    companies: companies ?? [],
  };
}
