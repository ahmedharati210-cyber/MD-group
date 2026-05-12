import "server-only";

import { cookies } from "next/headers";
import type { Profile } from "@/types/db";

/** HTTP-only cookie: active company for MD Group managers (`md_admin` without super admin). */
export const PORTAL_ACTIVE_COMPANY_COOKIE = "portal_active_company_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseValidCompanyId(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

/**
 * Company context for portal shell and guards.
 * - Super admins: no shell (full bypass elsewhere).
 * - Company managers / employees: `profile.company_id`.
 * - MD Group managers (`md_admin`, not super): validated active-company cookie.
 */
export function resolveShellCompanyIdFromSources(args: {
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">;
  activeCompanyCookie: string | undefined;
}): string | null {
  if (args.profile.is_super_admin) return null;
  if (args.profile.company_id) return args.profile.company_id;
  if (args.profile.role === "md_admin") {
    return parseValidCompanyId(args.activeCompanyCookie);
  }
  return null;
}

export async function getShellCompanyIdForProfile(
  profile: Pick<Profile, "role" | "company_id" | "is_super_admin">,
): Promise<string | null> {
  const cookie = (await cookies()).get(PORTAL_ACTIVE_COMPANY_COOKIE)?.value;
  return resolveShellCompanyIdFromSources({ profile, activeCompanyCookie: cookie });
}
