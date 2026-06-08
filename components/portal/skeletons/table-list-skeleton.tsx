export function TableListSkeleton({
  columns = 5,
  rows = 8,
  filterBar = true,
}: {
  columns?: number;
  rows?: number;
  filterBar?: boolean;
}) {
  const colWidths = [150, 120, 120, 110, 70];

  return (
    <div className="animate-pulse">
      {filterBar ? (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
          <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-10 w-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
      ) : null}

      <div className="md:hidden space-y-3">
        {Array.from({ length: Math.min(rows, 6) }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-5 w-14 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <div className="flex gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-800/60">
            {Array.from({ length: columns }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                style={{ width: colWidths[i] ?? 100 }}
              />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 px-5 py-3.5">
              {Array.from({ length: columns }).map((_, j) => (
                <div
                  key={j}
                  className="h-4 bg-gray-100 dark:bg-gray-800 rounded"
                  style={{ width: colWidths[j] ?? 100 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
