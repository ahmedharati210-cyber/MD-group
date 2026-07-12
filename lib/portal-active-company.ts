import "server-only";

import { cookies } from "next/headers";
import type { Profile } from "@/types/db";

/** HTTP-only cookie: active company for MD Group managers (`md_admin`) and owners (`owner`). */
export const PORTAL_ACTIVE_COMPANY_COOKIE = "portal_active_company_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseValidCompanyId(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

/** md_admin/owner are group-wide roles — never persist a fixed company_id. */
export function companyIdForProfileRole(
  role: Pick<Profile, "role">["role"],
  companyId: string | null | undefined,
): string | null {
  if (role === "md_admin" || role === "owner") return null;
  return companyId ?? null;
}

/**
 * Company context for portal shell and guards.
 * - Super admins: no shell (full bypass elsewhere).
 * - MD Group managers (`md_admin`, not super) and owners: validated active-company cookie.
 * - Company managers / employees: `profile.company_id`.
 */
export function resolveShellCompanyIdFromSources(args: {
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">;
  activeCompanyCookie: string | undefined;
}): string | null {
  if (args.profile.is_super_admin) return null;
  if (args.profile.role === "md_admin" || args.profile.role === "owner") {
    return parseValidCompanyId(args.activeCompanyCookie);
  }
  return args.profile.company_id ?? null;
}

export async function getShellCompanyIdForProfile(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
): Promise<string | null> {
  const cookie = (await cookies()).get(PORTAL_ACTIVE_COMPANY_COOKIE)?.value;
  return resolveShellCompanyIdFromSources({ profile, activeCompanyCookie: cookie });
}
