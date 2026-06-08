import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function MapsLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableListSkeleton columns={4} rows={6} filterBar={false} />
    </div>
  );
}
