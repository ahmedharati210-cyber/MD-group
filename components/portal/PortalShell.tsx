"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Menu, RefreshCw, Settings } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { LogoutButton } from "./LogoutButton";
import { isCompanyImmersivePath } from "@/lib/portal-shell-paths";
import { usePortalPushRefresh } from "@/lib/hooks/use-portal-push-refresh";
import { usePushRebind } from "@/lib/hooks/use-push-rebind";
import type { UserRole, AppFeature, RoleFeatures } from "@/types/db";

// Dynamically imported so framer-motion is excluded from the main portal
// bundle and only fetched in the browser when the banner becomes relevant.
const PwaInstallBanner = dynamic(
  () => import("./PwaInstallBanner").then((m) => m.PwaInstallBanner),
  { ssr: false },
);
const PwaSwUpdateBanner = dynamic(
  () => import("./PwaSwUpdateBanner").then((m) => m.PwaSwUpdateBanner),
  { ssr: false },
);
const PushOptInModal = dynamic(
  () => import("./PushOptInModal").then((m) => m.PushOptInModal),
  { ssr: false },
);

type Props = {
  role: UserRole;
  fullName: string;
  companyId: string | null;
  /** Active company for shell (managers via cookie; else profile.company_id path in layout). */
  shellCompanyId: string | null;
  companyName: string | null;
  isSuperAdmin: boolean;
  enabledFeatures: AppFeature[] | null;
  roleFeatures: RoleFeatures | null;
  pendingRequestsCount: number;
  unreadWarningAlerts: number;
  unreadNotificationAlerts: number;
  pendingSignupRequestsCount: number;
  expiredPapersCount: number;
  expiringSoonPapersCount: number;
  showDolceSignupNav: boolean;
  children: React.ReactNode;
};

export function PortalShell({
  role,
  fullName,
  companyId,
  shellCompanyId,
  companyName,
  isSuperAdmin,
  enabledFeatures,
  roleFeatures,
  pendingRequestsCount,
  unreadWarningAlerts,
  unreadNotificationAlerts,
  pendingSignupRequestsCount,
  expiredPapersCount,
  expiringSoonPapersCount,
  showDolceSignupNav,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const hideSidebar = useMemo(
    () => isCompanyImmersivePath(pathname),
    [pathname],
  );
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const handleOpen = useCallback(() => setIsOpen(true), []);

  usePortalPushRefresh();
  usePushRebind();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <PwaSwUpdateBanner />
      <PwaInstallBanner />
      <PushOptInModal />
      {!hideSidebar ? (
        <div className="print:hidden">
          <Sidebar
            role={role}
            fullName={fullName}
            companyId={companyId}
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
            isOpen={isOpen}
            onClose={handleClose}
          />
        </div>
      ) : null}

      {/* Mobile: menu + refresh only when the sidebar exists */}
      {!hideSidebar ? (
        <header className="print:hidden md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 min-h-14 pt-[env(safe-area-inset-top)] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={handleOpen}
            aria-label="فتح القائمة"
            className="min-h-11 min-w-11 inline-flex items-center justify-center -mr-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/portal" className="flex items-center gap-2">
            <span className="inline-flex rounded-lg bg-white shadow-xs ring-1 ring-gray-200 dark:ring-gray-700 p-0.5">
              <Image
                src="/Icon-MD.png"
                alt="MD Group"
                className="w-7 h-7 object-contain"
                width={28}
                height={28}
                priority
              />
            </span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              MD Group
            </span>
          </Link>
          <div className="flex items-center gap-1 -ml-2">
            <LogoutButton variant="icon" />
            <button
              type="button"
              onClick={() => router.refresh()}
              aria-label="تحديث الصفحة"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition-transform"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>
      ) : (
        <header className="print:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 min-h-14 pt-[env(safe-area-inset-top)] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/portal"
            className="flex items-center gap-2 min-w-0 text-gray-900 dark:text-gray-100"
          >
            <span className="inline-flex rounded-lg bg-white shadow-xs ring-1 ring-gray-200 dark:ring-gray-700 p-0.5 shrink-0">
              <Image
                src="/Icon-MD.png"
                alt="MD Group"
                className="w-7 h-7 object-contain"
                width={28}
                height={28}
                priority
              />
            </span>
            <span className="font-bold truncate">لوحة التحكم</span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {role === "md_admin" || isSuperAdmin ? (
              <Link
                href="/portal/companies"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">الشركات</span>
              </Link>
            ) : null}
            <Link
              href="/portal/settings"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="الإعدادات"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <LogoutButton variant="icon" />
            <button
              type="button"
              onClick={() => router.refresh()}
              aria-label="تحديث الصفحة"
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition-transform"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>
      )}

      <div
        className={
          hideSidebar ? "print:mr-0 overflow-x-hidden" : "md:mr-64 print:mr-0 overflow-x-hidden"
        }
      >
        <main className="p-4 sm:p-6 md:p-8 print:p-0 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
