export function DetailCardSkeleton({
  fields = 5,
  maxWidth = "max-w-2xl",
}: {
  fields?: number;
  maxWidth?: string;
}) {
  return (
    <div className={`${maxWidth} animate-pulse`}>
      <div className="h-4 w-36 bg-gray-100 dark:bg-gray-800 rounded-xs mb-6" />
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-xl shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded-xs" />
              <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800 rounded-xs" />
            </div>
          </div>
          <div className="h-9 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
        <div className="p-6 space-y-5">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded-xs" />
              <div className="h-4 w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
