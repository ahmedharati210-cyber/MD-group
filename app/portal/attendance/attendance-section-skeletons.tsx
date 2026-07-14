import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";
import { AR_WEEKDAY_LABELS } from "@/lib/attendance/calendar-shared";

export function AttendanceCalendarSkeleton() {
  const blanks = Array.from({ length: 3 });
  const days = Array.from({ length: 28 });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 animate-pulse">
      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`legend-${index}`}
            className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded"
          />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {AR_WEEKDAY_LABELS.map((day) => (
          <div key={day} className="py-1 text-xs text-gray-400 font-semibold">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, index) => (
          <div
            key={`blank-${index}`}
            className="min-h-[72px] bg-gray-50 dark:bg-gray-900/40 rounded-xl"
          />
        ))}
        {days.map((_, index) => (
          <div
            key={`day-${index}`}
            className="min-h-[72px] rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2"
          >
            <div className="h-4 w-5 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="mt-2 h-3 w-10 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendanceOverviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <CardGridSkeleton count={6} />
      <AttendanceCalendarSkeleton />
    </div>
  );
}

export function PersonListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-12 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40" />
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded-xs" />
            <div className="h-3 w-28 bg-gray-100 dark:bg-gray-800 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttendancePersonDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <CardGridSkeleton count={6} />
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="h-10 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-gray-50 dark:border-gray-800/60 px-4 flex items-center gap-4"
          >
            <div className="h-3 w-8 bg-gray-100 dark:bg-gray-800 rounded-xs" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded-xs" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded-xs flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
