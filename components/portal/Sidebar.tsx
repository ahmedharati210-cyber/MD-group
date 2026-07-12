"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  UserPlus,
  CalendarCheck,
  FileText,
  Mail,
  Contact,
  Settings,
  X,
  FolderKanban,
  FileBarChart2,
  ClipboardEdit,
  Receipt,
  Map,
  Bell,
  ShieldCheck,
  ScrollText,
  NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getVisibleFeatures,
  isMdManagerFeatureAllowed,
  isPlatformFeatureEnabled,
  MD_MANAGER_CORE_FEATURES,
  OWNER_FEATURES,
} from "@/lib/features";
import { LogoutButton } from "@/components/portal/LogoutButton";
import type { UserRole, AppFeature, RoleFeatures } from "@/types/db";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  /** Feature key required for this item; undefined = always visible */
  feature?: AppFeature;
};

const items: Item[] = [
  {
    href: "/portal",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    roles: ["md_admin", "company_manager", "employee", "owner"],
  },
  {
    // href is dynamically overridden for company_manager in the render loop
    href: "/portal/companies",
    label: "الشركات",
    icon: Building2,
    roles: ["md_admin", "owner"],
  },
  {
    href: "/portal/timeline",
    label: "المشاريع",
    icon: FolderKanban,
    roles: ["md_admin", "company_manager", "employee", "owner"],
    feature: "timeline",
  },
  {
    href: "/portal/employees",
    label: "الموظفون",
    icon: Users,
    roles: ["md_admin", "company_manager", "owner"],
  },
  {
    href: "/portal/employees/signup-requests",
    label: "طلبات التوظيف",
    icon: UserPlus,
    roles: ["md_admin", "company_manager"],
  },
  {
    href: "/portal/papers",
    label: "الأوراق الرسمية",
    icon: FileText,
    roles: ["md_admin", "company_manager", "employee", "owner"],
    feature: "papers",
  },
  {
    href: "/portal/mail",
    label: "البريد",
    icon: Mail,
    roles: ["md_admin", "company_manager", "owner"],
    feature: "mail",
  },
  {
    href: "/portal/contacts",
    label: "جهات الاتصال",
    icon: Contact,
    roles: ["md_admin", "company_manager", "employee", "owner"],
    feature: "contacts",
  },
  {
    href: "/portal/notifications",
    label: "مركز الإشعارات",
    icon: Bell,
    roles: ["md_admin", "company_manager", "employee"],
    feature: "warnings",
  },
  {
    href: "/portal/attendance",
    label: "الحضور",
    icon: CalendarCheck,
    roles: ["md_admin", "company_manager"],
    feature: "attendance",
  },
  {
    href: "/portal/timeline/drafts",
    label: "مسوداتي",
    icon: NotebookPen,
    roles: ["md_admin"],
    feature: "timeline",
  },
  {
    href: "/portal/reports",
    label: "التقارير",
    icon: FileBarChart2,
    roles: ["md_admin", "company_manager", "employee"],
    feature: "reports",
  },
  {
    href: "/portal/requests",
    label: "الطلبات",
    icon: ClipboardEdit,
    roles: ["md_admin", "company_manager", "employee"],
    feature: "requests",
  },
  {
    href: "/portal/claims",
    label: "المطالبات",
    icon: Receipt,
    roles: ["md_admin", "company_manager"],
    feature: "claims",
  },
  {
    href: "/portal/maps",
    label: "الخرائط",
    icon: Map,
    roles: ["md_admin", "company_manager", "employee"],
    feature: "maps",
  },
  {
    href: "/portal/settings",
    label: "الإعدادات",
    icon: Settings,
    roles: ["md_admin", "company_manager", "employee", "owner"],
  },
];

type Props = {
  role: UserRole;
  fullName: string;
  companyId: string | null;
  shellCompanyId: string | null;
  companyName: string | null;
  isSuperAdmin: boolean;
  enabledFeatures: AppFeature[] | null;
  roleFeatures: RoleFeatures | null;
  pendingRequestsCount: number;
  unreadWarningAlerts: number;
  unreadNotificationAlerts: number;
  pendingSignupRequestsCount: number;
  /** Papers past expiry — sidebar red badge */
  expiredPapersCount: number;
  /** Papers in the final month before expiry — sidebar orange badge */
  expiringSoonPapersCount: number;
  showDolceSignupNav: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({
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
  isOpen,
  onClose,
}: Props) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      onClose();
    }
  }, [pathname, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Compute the effective feature list for this role
  const visibleFeatures = getVisibleFeatures(
    role,
    enabledFeatures,
    roleFeatures,
    isSuperAdmin,
  );

  const visibleItems = items.filter((item) => {
    if (item.href === "/portal/timeline/drafts") {
      if (!(isSuperAdmin || role === "md_admin")) return false;
      if (isSuperAdmin) return true;
      return isMdManagerFeatureAllowed("timeline", enabledFeatures);
    }
    if (item.href === "/portal/attendance") {
      if (!(isSuperAdmin || role === "md_admin" || role === "company_manager")) {
        return false;
      }
      if (!isPlatformFeatureEnabled("attendance")) return false;
      if (isSuperAdmin || role === "md_admin") return true;
      if (visibleFeatures === null) return true;
      return visibleFeatures.includes("attendance");
    }
    if (!item.roles.includes(role)) return false;
    if (
      item.href === "/portal/employees/signup-requests" &&
      !showDolceSignupNav
    ) {
      return false;
    }
    if (!item.feature) return true;
    if (!isPlatformFeatureEnabled(item.feature)) return false;
    if (isSuperAdmin) return true;
    if (role === "md_admin" && !isSuperAdmin) {
      // Optional company modules (projects, reports, …) are reached from the company hub only,
      // not the global sidebar — avoids "leaking" the active company's enabled_features here.
      return MD_MANAGER_CORE_FEATURES.includes(item.feature);
    }
    // Owners always see their fixed feature set in the sidebar.
    if (role === "owner") return OWNER_FEATURES.includes(item.feature);
    if (visibleFeatures === null) return true;
    return visibleFeatures.includes(item.feature);
  });

  const isActive = (href: string) => {
    if (href === "/portal") return pathname === "/portal";
    if (href === "/portal/timeline/drafts") {
      return pathname.startsWith("/portal/timeline/drafts");
    }
    if (href === "/portal/timeline") {
      return (
        pathname.startsWith("/portal/timeline") &&
        !pathname.startsWith("/portal/timeline/drafts")
      );
    }
    if (href === "/portal/employees/signup-requests") {
      return pathname.startsWith("/portal/employees/signup-requests");
    }
    if (href === "/portal/employees") {
      if (pathname.startsWith("/portal/employees/signup-requests")) {
        return false;
      }
      return (
        pathname === "/portal/employees" ||
        pathname.startsWith("/portal/employees/")
      );
    }
    return pathname.startsWith(href);
  };

  const roleLabel: Record<UserRole, string> = {
    md_admin: "مدير مجموعة MD Group",
    company_manager: "مدير شركة",
    employee: "موظف",
    owner: "مالك",
  };

  /**
   * For company_manager, the "الشركات" entry resolves to their own company page.
   * For md_admin, it stays at the full companies list.
   */
  function resolveHref(item: Item): string {
    if (item.href === "/portal/companies" && role === "company_manager" && companyId) {
      return `/portal/companies/${companyId}`;
    }
    return item.href;
  }

  function resolveLabel(item: Item): string {
    if (item.href === "/portal/companies" && role === "company_manager") {
      return "شركتي";
    }
    return item.label;
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
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
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3 group">
            <span className="shrink-0 inline-flex rounded-xl bg-white shadow-xs ring-1 ring-gray-200 dark:ring-gray-700 p-1 transition-transform group-hover:scale-105">
              <Image
                src="/Icon-MD.png"
                alt="MD Group"
                className="w-8 h-8 object-contain"
                width={32}
                height={32}
                priority
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

        {/* User badge */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {fullName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {roleLabel[role]}
              {companyName ? ` • ${companyName}` : ""}
            </span>
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold">
                <ShieldCheck className="w-3 h-3" />
                Super Admin
              </span>
            ) : null}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const href = resolveHref(item);
              const label = resolveLabel(item);
              const active = isActive(href);
              const Icon = item.icon;
              const badge =
                item.href === "/portal/requests" && pendingRequestsCount > 0
                  ? { count: pendingRequestsCount, cls: "bg-amber-500" }
                  : item.href === "/portal/employees/signup-requests" &&
                          pendingSignupRequestsCount > 0
                        ? {
                            count: pendingSignupRequestsCount,
                            cls: "bg-amber-500",
                          }
                        : null;
              return (
                <li key={item.href}>
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
                        "w-5 h-5 shrink-0",
                        active
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-gray-400 dark:text-gray-500",
                      )}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {item.href === "/portal/papers" &&
                    (expiredPapersCount > 0 || expiringSoonPapersCount > 0) ? (
                      <span className="flex items-center gap-1 shrink-0">
                        {expiredPapersCount > 0 ? (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                            {expiredPapersCount > 99 ? "99+" : expiredPapersCount}
                          </span>
                        ) : null}
                        {expiringSoonPapersCount > 0 ? (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                            {expiringSoonPapersCount > 99
                              ? "99+"
                              : expiringSoonPapersCount}
                          </span>
                        ) : null}
                      </span>
                    ) : item.href === "/portal/notifications" &&
                      (unreadWarningAlerts > 0 || unreadNotificationAlerts > 0) ? (
                      <span className="flex items-center gap-1 shrink-0">
                        {unreadWarningAlerts > 0 ? (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                            {unreadWarningAlerts > 99 ? "99+" : unreadWarningAlerts}
                          </span>
                        ) : null}
                        {unreadNotificationAlerts > 0 ? (
                          <span className="min-w-5 h-5 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center tabular-nums">
                            {unreadNotificationAlerts > 99
                              ? "99+"
                              : unreadNotificationAlerts}
                          </span>
                        ) : null}
                      </span>
                    ) : badge ? (
                      <span className={cn("shrink-0 min-w-5 h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center tabular-nums", badge.cls)}>
                        {badge.count > 99 ? "99+" : badge.count}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Super admin section */}
          {isSuperAdmin ? (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                الإدارة العليا
              </p>
              {[
                { href: "/portal/admin", label: "لوحة الإدارة العليا", Icon: ShieldCheck },
                { href: "/portal/admin/audit", label: "سجل التدقيق", Icon: ScrollText },
              ].map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    pathname === href || (href !== "/portal/admin" && pathname.startsWith(href))
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      : "text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <LogoutButton variant="sidebar" />
        </div>
      </aside>
    </>
  );
}
