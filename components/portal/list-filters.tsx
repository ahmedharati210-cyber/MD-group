"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  buildListFilterSearch,
  clearListFilters,
  readListFilters,
  saveListFilters,
  urlHasListFilters,
} from "@/lib/portal-list-filters";

type RestoreListFiltersProps = {
  path: string;
  keys: readonly string[];
  /** Used when the URL is empty and nothing is saved (e.g. attendance defaults). */
  fallback?: Record<string, string>;
};

/**
 * On a clean list URL, restore last-used filters from localStorage.
 * When the URL already has filter keys, save them as the new last-used set.
 */
export function RestoreListFilters({
  path,
  keys,
  fallback,
}: RestoreListFiltersProps) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const current = new URLSearchParams(window.location.search);
    if (urlHasListFilters(current, keys)) {
      saveListFilters(path, current, keys);
      return;
    }

    const saved = readListFilters(path, keys);
    const values = saved ?? fallback ?? null;
    if (!values || Object.keys(values).length === 0) return;

    const qs = buildListFilterSearch(values, keys);
    if (!qs) return;
    router.replace(`${path}?${qs}`, { scroll: false });
  }, [fallback, keys, path, router]);

  return null;
}

type PersistListFiltersFormProps = {
  path: string;
  keys: readonly string[];
  children: ReactNode;
  className?: string;
  method?: "get";
};

/** Native GET form that also writes the submitted filters to localStorage. */
export function PersistListFiltersForm({
  path,
  keys,
  children,
  className,
  method = "get",
}: PersistListFiltersFormProps) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const fd = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of fd.entries()) {
      if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
      }
    }
    saveListFilters(path, params, keys);
  }

  return (
    <form method={method} className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

type ClearListFiltersLinkProps = {
  path: string;
  href: string;
  className?: string;
  children: ReactNode;
};

export function ClearListFiltersLink({
  path,
  href,
  className,
  children,
}: ClearListFiltersLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        clearListFilters(path);
      }}
    >
      {children}
    </Link>
  );
}
