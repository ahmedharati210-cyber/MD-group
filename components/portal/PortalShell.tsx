"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Menu, RefreshCw } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { PwaInstallBanner } from "./PwaInstallBanner";
import type { UserRole, AppFeature, RoleFeatures } from "@/types/db";

type Props = {
  role: UserRole;
  fullName: string;
  companyId: string | null;
  companyName: string | null;
  isSuperAdmin: boolean;
  enabledFeatures: AppFeature[] | null;
  roleFeatures: RoleFeatures | null;
  pendingRequestsCount: number;
  unreadWarningsCount: number;
  children: React.ReactNode;
};

export function PortalShell({
  role,
  fullName,
  companyId,
  companyName,
  isSuperAdmin,
  enabledFeatures,
  roleFeatures,
  pendingRequestsCount,
  unreadWarningsCount,
  children,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const handleOpen = useCallback(() => setIsOpen(true), []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <PwaInstallBanner />
      <div className="print:hidden">
        <Sidebar
          role={role}
          fullName={fullName}
          companyId={companyId}
          companyName={companyName}
          isSuperAdmin={isSuperAdmin}
          enabledFeatures={enabledFeatures}
          roleFeatures={roleFeatures}
          pendingRequestsCount={pendingRequestsCount}
          unreadWarningsCount={unreadWarningsCount}
          isOpen={isOpen}
          onClose={handleClose}
        />
      </div>

      {/* Mobile topbar */}
      <header className="print:hidden md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={handleOpen}
          aria-label="فتح القائمة"
          className="p-2 -mr-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link href="/portal" className="flex items-center gap-2">
          <span className="inline-flex rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-0.5">
            <img
              src="/Icon-MD.png"
              alt="MD Group"
              className="w-7 h-7 object-contain"
              width={28}
              height={28}
            />
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            MD Group
          </span>
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          aria-label="تحديث الصفحة"
          className="p-2 -ml-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition-transform"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </header>

      <div className="md:mr-64 print:mr-0">
        <main className="p-4 sm:p-6 md:p-8 print:p-0 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
