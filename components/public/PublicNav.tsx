"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navItems = [
  { href: "/", label: "الرئيسية" },
  { href: "/about", label: "عن المجموعة" },
  { href: "/contact", label: "اتصل بنا" },
];

export function PublicNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 transition-shadow",
        scrolled
          ? "shadow-md dark:shadow-black/50"
          : "shadow-sm dark:shadow-black/30",
      )}
    >
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-3 md:gap-4 group min-w-0">
            <span className="flex-shrink-0 rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-1 transition-transform group-hover:scale-105 inline-flex">
              <img
                src="/Icon-MD.png"
                alt="MD Group"
                className="w-8 h-8 md:w-11 md:h-11 object-contain"
                width={44}
                height={44}
              />
            </span>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight truncate">
                MD Group
              </h1>
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">
                مجموعة شركات متكاملة
              </p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-4 py-2 rounded-xl font-semibold text-sm transition-all",
                  isActive(item.href)
                    ? "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30"
                    : "text-gray-700 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                )}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle className="mx-1" />
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white font-semibold text-sm shadow-md hover:bg-primary-700 hover:shadow-lg transition-all"
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              className="p-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isOpen ? (
          <div className="md:hidden py-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-xl font-semibold text-sm",
                  isActive(item.href)
                    ? "text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm"
            >
              <LogIn className="w-4 h-4" />
              تسجيل الدخول
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
