import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { AttendancePersonDetailSkeleton } from "../attendance-section-skeletons";

export default function AttendancePersonLoading() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      <PageHeaderSkeleton showAction={false} />
      <div className="h-10 w-full max-w-3xl bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      <AttendancePersonDetailSkeleton />
    </div>
  );
}
