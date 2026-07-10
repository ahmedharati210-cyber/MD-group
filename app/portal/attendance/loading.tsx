import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";

const AR_DAYS = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function AttendanceCalendarSkeleton() {
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
        {AR_DAYS.map((day) => (
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

export default function AttendanceLoading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton actionWidth="w-36" />
      <div className="h-10 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      <CardGridSkeleton count={4} />
      <AttendanceCalendarSkeleton />
    </div>
  );
}
