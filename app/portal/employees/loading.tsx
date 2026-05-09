export default function EmployeesLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="h-7 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800/60 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-xl flex-shrink-0" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        <div className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="h-10 w-40 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-5 w-14 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="col-span-2 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {/* Header */}
          <div className="flex gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-800/60">
            {[150, 120, 120, 110, 70].map((w, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-5 py-3.5">
              <div className="space-y-1" style={{ width: 150 }}>
                <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: 120 }} />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: 120 }} />
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded" style={{ width: 110 }} />
              <div className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
