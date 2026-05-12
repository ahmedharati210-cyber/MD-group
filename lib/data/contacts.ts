import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isConstructionCompany } from "@/lib/features";

export type ContactsData = {
  contacts: unknown[];
  totalCount: number;
  companies: { id: string; name_ar: string }[];
  showTradeFilter: boolean;
};

/**
 * Paginated contacts list with company dropdown and trade filter flag.
 * All filter values are passed as explicit args so each unique combination
 * is cached as a separate entry. Revalidated by contacts/actions.ts.
 */
export async function getContactsData(params: {
  role: string;
  companyId: string | null;
  /** Active shell company for MD Group managers (trade filter / construction flag). */
  shellCompanyId?: string | null;
  q: string | undefined;
  filterCompanyId: string | undefined;
  trade: string | undefined;
  page: number;
  pageSize: number;
}): Promise<ContactsData> {
  const supabase = await createSupabaseServerClient();
  const offset = (params.page - 1) * params.pageSize;

  const tradeContextCompanyId =
    params.role === "md_admin"
      ? (params.shellCompanyId ?? params.companyId)
      : params.companyId;

  const showTradeFilter =
    params.role === "md_admin" ||
    (await isConstructionCompany(supabase, tradeContextCompanyId));

  let query = supabase
    .from("contacts")
    .select("*, companies(name_ar)", { count: "exact" })
    .order("full_name")
    .range(offset, offset + params.pageSize - 1);

  if (params.q) query = query.ilike("full_name", `%${params.q}%`);
  if (params.filterCompanyId) query = query.eq("company_id", params.filterCompanyId);
  if (params.trade) query = query.eq("trade_category", params.trade);

  const { data: contacts, count } = await query;

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name_ar")
    .order("name_ar");

  return {
    contacts: contacts ?? [],
    totalCount: count ?? 0,
    companies: (companies ?? []) as { id: string; name_ar: string }[],
    showTradeFilter,
  };
}
