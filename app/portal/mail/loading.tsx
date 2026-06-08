import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function MailLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableListSkeleton columns={4} rows={8} />
    </div>
  );
}
