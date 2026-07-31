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

/**
 * Build a before/after diff for the listed fields. Only fields whose values
 * actually changed are included. Callers should skip logging when the result
 * is empty (no-op save).
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): Record<string, { before: unknown; after: unknown }> {
  const changed: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of fields) {
    const b = before[field];
    const a = field in after ? after[field] : b;
    if (a !== b) changed[field as string] = { before: b, after: a };
  }
  return changed;
}
