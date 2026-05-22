import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/types/db";

export type PaperDoc = DocumentRow & {
  companies?: { name_ar: string } | null;
};

export type PapersData = {
  docs: PaperDoc[];
  companies: { id: string; name_ar: string }[];
};

/**
 * Official documents with full-text search and category/company filters.
 * Each unique combination of (q, category, companyId) is cached separately
 * because they're passed as explicit args. Revalidated by papers/actions.ts.
 */
export async function getPapersData(params: {
  q?: string;
  category?: string;
  companyId?: string;
}): Promise<PapersData> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("documents")
    .select("*, companies(name_ar)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.q?.trim()) {
    query = query.or(`title.ilike.%${params.q}%,content_text.ilike.%${params.q}%`);
  }
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  const [{ data: docs }, { data: companies }] = await Promise.all([
    query,
    supabase.from("companies").select("id, name_ar").order("name_ar"),
  ]);

  return {
    docs: (docs ?? []) as PaperDoc[],
    companies: (companies ?? []) as { id: string; name_ar: string }[],
  };
}
