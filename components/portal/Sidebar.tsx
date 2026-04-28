"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  FileText,
  Mail,
  Contact,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import type { UserRole } from "@/types/db";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const items: Item[] = [
  {
    href: "/portal",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    roles: ["md_admin", "company_manager", "employee"],
  },
  {
    href: "/portal/companies",
    label: "الشركات",
    icon: Building2,
    roles: ["md_admin", "company_manager"],
  },
  {
    href: "/portal/employees",
    label: "الموظفون",
    icon: Users,
    roles: ["md_admin", "company_manager"],
  },
  {
    href: "/portal/attendance",
    label: "الحضور",
    icon: CalendarCheck,
    roles: ["md_admin", "company_manager", "employee"],
  },
  {
    href: "/portal/papers",
    label: "الأوراق الرسمية",
    icon: FileText,
    roles: ["md_admin", "company_manager", "employee"],
  },
  {
    href: "/portal/mail",
    label: "البريد",
    icon: Mail,
    roles: ["md_admin", "company_manager"],
  },
  {
    href: "/portal/contacts",
    label: "جهات الاتصال",
    icon: Contact,
    roles: ["md_admin", "company_manager", "employee"],
  },
  {
    href: "/portal/settings",
    label: "الإعدادات",
    icon: Settings,
    roles: ["md_admin", "company_manager", "employee"],
  },
];

type Props = {
  role: UserRole;
  fullName: string;
  companyName: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ role, fullName, companyName, isOpen, onClose }: Props) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  // Auto-close on route change (mobile). Only fires when the path actually
  // changes — not on every re-render, otherwise the drawer can never stay open.
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  // Lock scroll when drawer is open on mobile.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const visibleItems = items.filter((i) => i.roles.includes(role));
  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  const roleLabel: Record<UserRole, string> = {
    md_admin: "مدير مجموعة MD",
    company_manager: "مدير شركة",
    employee: "موظف",
  };

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed right-0 top-0 h-screen w-72 md:w-64 bg-white dark:bg-gray-900",
          "border-l border-gray-200 dark:border-gray-800 flex flex-col z-50",
          "transition-transform duration-300",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full md:translate-x-0",
        )}
      >
        <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3 group">
            <span className="flex-shrink-0 inline-flex rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-1 transition-transform group-hover:scale-105">
              <img
                src="/Icon-MD.png"
                alt="MD Group"
                className="w-8 h-8 object-contain"
                width={32}
                height={32}
              />
            </span>
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
                MD Group
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                بوابة العمل
              </div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {fullName}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {roleLabel[role]}
            {companyName ? ` • ${companyName}` : ""}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        active
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-gray-400 dark:text-gray-500",
                      )}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
