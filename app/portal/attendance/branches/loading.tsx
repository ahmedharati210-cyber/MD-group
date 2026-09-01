import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { PersonListSkeleton } from "../attendance-section-skeletons";

export default function AttendanceBranchesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton showAction={false} />
      <div className="h-10 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-48 rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 animate-pulse"
          />
        ))}
      </div>
      <PersonListSkeleton />
    </div>
  );
}
