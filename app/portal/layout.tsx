import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCompanyData } from "@/lib/company";
import { getBadgeCounts } from "@/lib/data/badges";
import { PortalShell } from "@/components/portal/PortalShell";
import type { AppFeature, RoleFeatures } from "@/types/db";

export const metadata: import("next").Metadata = {
  title: "لوحة التحكم",
  applicationName: "MD Group",
  manifest: "/portal-manifest.json",
  appleWebApp: {
    capable: true,
    title: "MD Group",
    statusBarStyle: "default",
  },
};

/**
 * Sync outer component — prerenderable static shell (just a Suspense boundary).
 * The actual auth + data fetching happens inside AuthenticatedPortal, which
 * is wrapped in Suspense so Next.js can stream it without blocking the shell.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <AuthenticatedPortal>{children}</AuthenticatedPortal>
    </Suspense>
  );
}

/**
 * Async inner component — dynamic (reads cookies through requireUser).
 * connection() signals to Next.js that this subtree is always rendered
 * at request time and should not be partially prerendered.
 */
async function AuthenticatedPortal({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { profile } = await requireUser();

  const isSuperAdmin = profile.is_super_admin ?? false;
  const isEmployee = profile.role === "employee";

  // Both calls only need profile.id / profile.company_id — run them in
  // parallel so the layout doesn't wait for company data before starting
  // the badge queries.
  const [companyRow, { pendingRequests: pendingRequestsCount, unreadWarnings: unreadWarningsCount }] =
    await Promise.all([
      profile.company_id ? getCompanyData(profile.company_id) : Promise.resolve(null),
      getBadgeCounts({ userId: profile.id ?? "", isEmployee }),
    ]);

  const companyName = companyRow?.name_ar ?? null;
  const enabledFeatures: AppFeature[] | null = companyRow?.enabled_features ?? null;
  const roleFeatures: RoleFeatures | null = companyRow?.role_features ?? null;

  return (
    <PortalShell
      role={profile.role}
      fullName={profile.full_name}
      companyId={profile.company_id}
      companyName={companyName}
      isSuperAdmin={isSuperAdmin}
      enabledFeatures={enabledFeatures}
      roleFeatures={roleFeatures}
      pendingRequestsCount={pendingRequestsCount}
      unreadWarningsCount={unreadWarningsCount}
    >
      {children}
    </PortalShell>
  );
}
