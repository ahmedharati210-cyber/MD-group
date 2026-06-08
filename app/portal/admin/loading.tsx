import { FormSectionsSkeleton } from "@/components/portal/skeletons/form-sections-skeleton";
import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <PageHeaderSkeleton showAction={false} />
      <FormSectionsSkeleton sections={2} />
      <TableListSkeleton columns={4} rows={6} filterBar={false} />
    </div>
  );
}
