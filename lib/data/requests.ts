import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RequestType, RequestStatus } from "@/types/db";

export type RequestRow = {
  id: string;
  request_type: RequestType;
  description: string;
  requested_date: string | null;
  status: RequestStatus;
  created_at: string;
  requester: { full_name: string } | null;
};

/**
 * Engineer requests list with role-based and status/type filters.
 * Short TTL (30s stale) because requests reflect actionable states.
 * Revalidated by requests/actions.ts.
 */
export async function getRequestsData(params: {
  profileId: string;
  isManager: boolean;
  filterStatus?: string;
  filterType?: string;
  filterCompanyId?: string;
}): Promise<RequestRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("engineer_requests")
    .select(
      "id, request_type, description, requested_date, status, created_at, requester:requester_id(full_name)",
    )
    .order("created_at", { ascending: false });

  if (!params.isManager) query = query.eq("requester_id", params.profileId);
  if (params.isManager && params.filterCompanyId) {
    query = query.eq("company_id", params.filterCompanyId);
  }
  if (params.filterStatus) query = query.eq("status", params.filterStatus);
  if (params.filterType) query = query.eq("request_type", params.filterType);

  const { data } = await query;
  return (data ?? []) as unknown as RequestRow[];
}
