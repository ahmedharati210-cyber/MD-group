"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  basePath: string;
  defaultValue?: string;
  placeholder?: string;
  preserveKeys?: string[];
};

export function AttendanceSearch({
  basePath,
  defaultValue = "",
  placeholder = "بحث بالاسم أو رقم البصمة...",
  preserveKeys = ["companyId", "branchId", "month", "day", "personId"],
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = (fd.get("q") as string | null)?.trim() ?? "";
    const params = new URLSearchParams();
    for (const key of preserveKeys) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    if (q) params.set("q", q);
    router.push(`${basePath}?${params.toString()}`);
  }

  const clearParams = new URLSearchParams();
  for (const key of preserveKeys) {
    const value = searchParams.get(key);
    if (value) clearParams.set(key, value);
  }
  const clearHref = `${basePath}?${clearParams.toString()}`;

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm"
        >
          بحث
        </button>
        {defaultValue ? (
          <Link
            href={clearHref}
            className="inline-flex items-center gap-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold"
          >
            <X className="w-4 h-4" />
            مسح
          </Link>
        ) : null}
      </div>
    </form>
  );
}
