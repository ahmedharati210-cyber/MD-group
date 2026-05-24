import "server-only";

import {
  isPaperExpiryNeedsRenewal,
  isPaperExpiryOk,
  paperExpiryPostgrestOrFilter,
  type PaperExpiryFilter,
} from "@/lib/paper-expiry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentRow } from "@/types/db";

export type PaperDoc = DocumentRow & {
  companies?: { name_ar: string } | null;
};

export type PaperExpiryCounts = {
  ok: number;
  renew: number;
};

export type PapersData = {
  docs: PaperDoc[];
  companies: { id: string; name_ar: string }[];
  expiryCounts: PaperExpiryCounts;
};

function emptyExpiryCounts(): PaperExpiryCounts {
  return { ok: 0, renew: 0 };
}

function parseExpiryFilter(value?: string): PaperExpiryFilter {
  if (value === "ok" || value === "renew") return value;
  return "all";
}

/**
 * Official documents with full-text search and category/company/expiry filters.
 * Revalidated by papers/actions.ts.
 */
export async function getPapersData(params: {
  q?: string;
  category?: string;
  companyId?: string;
  expiry?: string;
}): Promise<PapersData> {
  const supabase = await createSupabaseServerClient();
  const expiryFilter = parseExpiryFilter(params.expiry);

  let query = supabase
    .from("documents")
    .select("*, companies(name_ar)")
    .order("created_at", { ascending: false })
    .limit(100);

  let expiryCountQuery = supabase.from("documents").select("expires_on");

  if (params.q?.trim()) {
    const orFilter = `title.ilike.%${params.q}%,content_text.ilike.%${params.q}%`;
    query = query.or(orFilter);
    expiryCountQuery = expiryCountQuery.or(orFilter);
  }
  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
    expiryCountQuery = expiryCountQuery.eq("company_id", params.companyId);
  }
  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }
  if (expiryFilter !== "all") {
    query = query.or(paperExpiryPostgrestOrFilter(expiryFilter));
  }

  const [{ data: docs }, { data: companies }, { data: expiryRows }] =
    await Promise.all([
      query,
      supabase.from("companies").select("id, name_ar").order("name_ar"),
      expiryCountQuery,
    ]);

  const expiryCounts = emptyExpiryCounts();

  for (const row of expiryRows ?? []) {
    const expiresOn = (row as { expires_on: string | null }).expires_on;
    if (isPaperExpiryOk(expiresOn)) {
      expiryCounts.ok += 1;
    } else if (isPaperExpiryNeedsRenewal(expiresOn)) {
      expiryCounts.renew += 1;
    }
  }

  return {
    docs: (docs ?? []) as PaperDoc[],
    companies: (companies ?? []) as { id: string; name_ar: string }[],
    expiryCounts,
  };
}
