export default function TimelineLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg mb-2" />
          <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800/60 rounded" />
        </div>
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-800 rounded-xl flex-shrink-0" />
      </div>

      {/* Project cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3"
          >
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex-shrink-0" />
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded-full flex-shrink-0" />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
            </div>

            {/* Meta */}
            <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />

            {/* Progress */}
            <div className="mt-auto">
              <div className="flex justify-between mb-1.5">
                <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-200 dark:bg-primary-800 rounded-full"
                  style={{ width: `${30 + (i % 4) * 20}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
