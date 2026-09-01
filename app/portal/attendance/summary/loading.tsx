import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";
import { PersonListSkeleton } from "../attendance-section-skeletons";

export default function AttendanceSummaryLoading() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      <PageHeaderSkeleton actionWidth="w-36" />
      <div className="h-10 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      <CardGridSkeleton count={4} />
      <PersonListSkeleton />
    </div>
  );
}
