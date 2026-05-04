import "server-only";
import { createSupabaseAdminClient } from "./supabase/server";

/**
 * Write a single audit log entry using the service-role client (bypasses RLS).
 * Non-fatal: any failure is silently swallowed so the caller is never disrupted.
 */
export async function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  payload?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      actor_id: actorId ?? null,
      action,
      entity,
      entity_id: entityId ?? null,
      payload: payload ?? null,
    });
  } catch {
    // Audit failures must never break user-facing flows.
  }
}
