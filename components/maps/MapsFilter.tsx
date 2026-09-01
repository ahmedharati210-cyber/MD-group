"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useRef } from "react";
import {
  LIST_FILTER_KEYS,
  clearListFilters,
  saveListFilters,
} from "@/lib/portal-list-filters";

type ProjectOption = { id: string; name: string };

const selectCls =
  "px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";

const PATH = "/portal/maps";
const KEYS = LIST_FILTER_KEYS.maps;

export function MapsFilter({
  projects,
  currentProjectId,
  currentQuery,
  currentCompanyId = "",
}: {
  projects: ProjectOption[];
  currentProjectId: string;
  currentQuery: string;
  currentCompanyId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  function buildParams(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      project_id: currentProjectId,
      q: currentQuery,
      companyId: currentCompanyId,
      ...overrides,
    };
    const next = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    return next;
  }

  function navigate(params: URLSearchParams) {
    saveListFilters(PATH, params, KEYS);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function updateProject(value: string) {
    navigate(buildParams({ project_id: value }));
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    navigate(buildParams({ q }));
  }

  function clearAll() {
    if (inputRef.current) inputRef.current.value = "";
    clearListFilters(PATH);
    router.replace(pathname, { scroll: false });
  }

  const hasFilter = !!currentProjectId || !!currentQuery || !!currentCompanyId;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {projects.length > 0 ? (
        <select value={currentProjectId} onChange={(e) => updateProject(e.target.value)} className={selectCls}>
          <option value="">كل المشاريع</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      ) : null}

      <form onSubmit={submitSearch} className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            defaultValue={currentQuery}
            placeholder="ابحث باسم الخريطة..."
            className="pr-9 pl-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden w-52"
          />
        </div>
        <button type="submit" className="px-4 py-2 text-sm bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors">
          بحث
        </button>
      </form>

      {hasFilter ? (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          مسح
        </button>
      ) : null}
    </div>
  );
}
