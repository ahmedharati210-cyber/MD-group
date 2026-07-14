import { FormSectionsSkeleton } from "@/components/portal/skeletons/form-sections-skeleton";
import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";

export default function EmployeeDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded-xs mb-4" />
      <PageHeaderSkeleton actionWidth="w-28" />
      <FormSectionsSkeleton sections={3} />
    </div>
  );
}
