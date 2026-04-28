"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import type { UserRole } from "@/types/db";

type Props = {
  role: UserRole;
  fullName: string;
  companyName: string | null;
  children: React.ReactNode;
};

export function PortalShell({ role, fullName, companyName, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const handleOpen = useCallback(() => setIsOpen(true), []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        role={role}
        fullName={fullName}
        companyName={companyName}
        isOpen={isOpen}
        onClose={handleClose}
      />

      {/* Mobile topbar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
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
        <div className="w-9" aria-hidden />
      </header>

      <div className="md:mr-64">
        <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
