import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalCount: number;
  pageSize: number;
  baseUrl: string;
  extraParams?: Record<string, string>;
};

export function Pagination({ page, totalCount, pageSize, baseUrl, extraParams = {} }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const buildHref = (p: number) => {
    const params = new URLSearchParams({ ...extraParams, page: String(p) });
    return `${baseUrl}?${params.toString()}`;
  };

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const btnBase =
    "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors";
  const activeBtn =
    "bg-primary-600 text-white hover:bg-primary-700 shadow-xs";
  const inactiveBtn =
    "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800";
  const disabledBtn =
    "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed";

  // Build a window of page numbers around the current page
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <nav aria-label="التنقل بين الصفحات" className="flex items-center justify-between gap-3 mt-6">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        الصفحة {page} من {totalPages} ({totalCount} نتيجة)
      </div>
      <div className="flex items-center gap-1.5">
        {hasPrev ? (
          <Link href={buildHref(page - 1)} className={cn(btnBase, inactiveBtn)}>
            <ChevronRight className="w-4 h-4" />
            السابق
          </Link>
        ) : (
          <span className={cn(btnBase, disabledBtn)}>
            <ChevronRight className="w-4 h-4" />
            السابق
          </span>
        )}

        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-2 text-gray-400 dark:text-gray-500">…</span>
            ) : (
              <Link
                key={p}
                href={buildHref(p as number)}
                className={cn(btnBase, "px-3", p === page ? activeBtn : inactiveBtn)}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </Link>
            ),
          )}
        </div>

        {hasNext ? (
          <Link href={buildHref(page + 1)} className={cn(btnBase, inactiveBtn)}>
            التالي
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : (
          <span className={cn(btnBase, disabledBtn)}>
            التالي
            <ChevronLeft className="w-4 h-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
