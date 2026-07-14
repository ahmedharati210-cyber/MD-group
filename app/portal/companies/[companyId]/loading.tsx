import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";
import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";

export default function CompanyDetailLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded-xs" />
      <PageHeaderSkeleton actionWidth="w-36" />
      <CardGridSkeleton count={9} />
    </div>
  );
}
