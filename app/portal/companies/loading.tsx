import { CardGridSkeleton } from "@/components/portal/skeletons/card-grid-skeleton";
import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";

export default function CompaniesLoading() {
  return (
    <div className="animate-pulse">
      <PageHeaderSkeleton actionWidth="w-36" />
      <CardGridSkeleton />
    </div>
  );
}
