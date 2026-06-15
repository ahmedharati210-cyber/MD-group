import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCompanyData } from "@/lib/company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getBadgeCounts } from "@/lib/data/badges";
import { resolveDolceEmployeeSignupAccess } from "@/lib/dolce-signup-company";
import { PortalShellSkeleton } from "@/components/portal/PortalShellSkeleton";
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
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
    <Suspense fallback={<PortalShellSkeleton />}>
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
  const { profile, accessToken } = await requireUser();

  const isSuperAdmin = profile.is_super_admin ?? false;
  const isEmployee = profile.role === "employee";
  const isOwner = profile.role === "owner";

  const [shellCompanyId, companyRow] = await Promise.all([
    getShellCompanyIdForProfile(profile),
    (async () => {
      const featuresCompanyId =
        profile.role === "company_manager"
          ? profile.company_id
          : await getShellCompanyIdForProfile(profile);
      return featuresCompanyId
        ? getCompanyData(featuresCompanyId)
        : Promise.resolve(null);
    })(),
  ]);

  const badgeCompanyId = profile.is_super_admin
    ? null
    : profile.role === "md_admin" || isOwner
      ? shellCompanyId
      : profile.company_id;

  const preliminaryDolceAccess = resolveDolceEmployeeSignupAccess(
    profile,
    shellCompanyId,
    companyRow?.enabled_features ?? null,
  );

  const badgeCounts = await getBadgeCounts(
    {
      userId: profile.id ?? "",
      isEmployee,
      role: profile.role,
      companyId: badgeCompanyId,
      isSuperAdmin: profile.is_super_admin ?? false,
      includeDolceSignupBadges: preliminaryDolceAccess,
    },
    accessToken,
  );

  const showDolceSignupNav = resolveDolceEmployeeSignupAccess(
    profile,
    shellCompanyId,
    companyRow?.enabled_features ?? null,
  );

  const pendingRequestsCount = badgeCounts.pendingRequests;
  const unreadWarningAlerts = badgeCounts.unreadWarningAlerts;
  const unreadNotificationAlerts = badgeCounts.unreadNotificationAlerts;
  const pendingSignupRequestsCount = badgeCounts.pendingSignupRequests;
  const expiredPapersCount = badgeCounts.expiredPapers;
  const expiringSoonPapersCount = badgeCounts.expiringSoonPapers;

  const companyName = companyRow?.name_ar ?? null;
  const enabledFeatures: AppFeature[] | null = companyRow?.enabled_features ?? null;
  const roleFeatures: RoleFeatures | null = companyRow?.role_features ?? null;

  return (
    <PortalShell
      role={profile.role}
      fullName={profile.full_name}
      companyId={profile.company_id}
      shellCompanyId={shellCompanyId}
      companyName={companyName}
      isSuperAdmin={isSuperAdmin}
      enabledFeatures={enabledFeatures}
      roleFeatures={roleFeatures}
      pendingRequestsCount={pendingRequestsCount}
      unreadWarningAlerts={unreadWarningAlerts}
      unreadNotificationAlerts={unreadNotificationAlerts}
      pendingSignupRequestsCount={pendingSignupRequestsCount}
      expiredPapersCount={expiredPapersCount}
      expiringSoonPapersCount={expiringSoonPapersCount}
      showDolceSignupNav={showDolceSignupNav}
    >
      {children}
    </PortalShell>
  );
}
