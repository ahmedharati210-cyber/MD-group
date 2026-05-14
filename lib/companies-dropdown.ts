import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Portal company pickers: `display_order` first (MD Group HQ = 0), then Arabic name.
 */
export async function fetchCompaniesForDropdown<
  T extends { id: string; name_ar: string } = { id: string; name_ar: string },
>(
  client: SupabaseClient,
  options?: { columns?: string; eqId?: string },
): Promise<T[]> {
  const columns = options?.columns ?? "id, name_ar";
  let q = client
    .from("companies")
    .select(columns)
    .order("display_order", { ascending: true })
    .order("name_ar", { ascending: true });
  if (options?.eqId) q = q.eq("id", options.eqId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as T[];
}
