import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function NotificationsLoading() {
  return (
    <div>
      <PageHeaderSkeleton showAction={false} />
      <TableListSkeleton columns={3} rows={8} filterBar={false} />
    </div>
  );
}
