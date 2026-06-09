export function FormSectionsSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <div className="max-w-2xl space-y-5 sm:space-y-6">
      {Array.from({ length: sections }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs space-y-4"
        >
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded-xs" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
            <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-xl" />
            {i === 0 ? (
              <div className="h-24 w-24 bg-gray-100 dark:bg-gray-800 rounded-full" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
