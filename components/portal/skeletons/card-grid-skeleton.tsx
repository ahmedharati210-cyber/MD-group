export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-5 w-5 bg-gray-100 dark:bg-gray-800 rounded-xs" />
          </div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded-xs" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded-xs" />
          <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded-xs pt-3 border-t border-gray-100 dark:border-gray-800" />
        </div>
      ))}
    </div>
  );
}
