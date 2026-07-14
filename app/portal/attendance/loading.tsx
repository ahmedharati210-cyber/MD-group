import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";
import {
  AttendanceCalendarSkeleton,
  AttendancePersonDetailSkeleton,
} from "./attendance-section-skeletons";

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

export { AttendancePersonDetailSkeleton };
