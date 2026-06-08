import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function WarningsLoading() {
  return (
    <div>
      <PageHeaderSkeleton showAction={false} />
      <TableListSkeleton columns={3} rows={8} filterBar={false} />
    </div>
  );
}
