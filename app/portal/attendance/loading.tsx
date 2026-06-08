import { PageHeaderSkeleton } from "@/components/portal/skeletons/page-header-skeleton";
import { TableListSkeleton } from "@/components/portal/skeletons/table-list-skeleton";

export default function AttendanceLoading() {
  return (
    <div>
      <PageHeaderSkeleton actionWidth="w-36" />
      <TableListSkeleton columns={5} rows={10} />
    </div>
  );
}
