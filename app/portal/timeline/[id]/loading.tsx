import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";

function CategorySkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded-xs" />
        <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800"
          />
        ))}
      </div>
    </div>
  );
}

export default function TimelineProjectLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded-xs" />
      <PageHeaderSkeleton actionWidth="w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800"
          />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <CategorySkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
