import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCompanyData } from "@/lib/company";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { getBadgeCounts } from "@/lib/data/badges";
import {
  getDolceSignupCompanyId,
  resolveDolceEmployeeSignupAccess,
} from "@/lib/dolce-signup-company";
import { PortalBootSplash } from "@/components/portal/PortalBootSplash";
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
    <Suspense fallback={<PortalBootSplash />}>
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

  const [shellCompanyId, dolceSignupCompanyId] = await Promise.all([
    getShellCompanyIdForProfile(profile),
    getDolceSignupCompanyId(),
  ]);

  const companyRow = shellCompanyId
    ? await getCompanyData(shellCompanyId)
    : null;

  const showDolceSignupNav = resolveDolceEmployeeSignupAccess(
    profile,
    dolceSignupCompanyId,
    shellCompanyId,
    companyRow?.enabled_features ?? null,
  );

  const badgeCompanyId = profile.is_super_admin
    ? null
    : profile.role === "md_admin"
      ? shellCompanyId
      : profile.company_id;

  const badgeCounts = await getBadgeCounts({
    userId: profile.id ?? "",
    isEmployee,
    role: profile.role,
    companyId: badgeCompanyId,
    isSuperAdmin: profile.is_super_admin ?? false,
    dolceSignupCompanyId,
    includeDolceSignupBadges: showDolceSignupNav,
  });

  const pendingRequestsCount = badgeCounts.pendingRequests;
  const unreadWarningAlerts = badgeCounts.unreadWarningAlerts;
  const unreadNotificationAlerts = badgeCounts.unreadNotificationAlerts;
  const pendingSignupRequestsCount = badgeCounts.pendingSignupRequests;
  const expiringPapersCount = badgeCounts.expiringPapers;

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
      expiringPapersCount={expiringPapersCount}
      showDolceSignupNav={showDolceSignupNav}
    >
      {children}
    </PortalShell>
  );
}
