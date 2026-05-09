import Link from "next/link";
import { Plus, ClipboardEdit, CalendarDays, User } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getRequestsData } from "@/lib/data/requests";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { RequestsFilter } from "@/components/requests/RequestsFilter";
import type { RequestType, RequestStatus } from "@/types/db";

export const metadata = { title: "الطلبات" };

const typeLabels: Record<RequestType, string> = {
  vacation: "إجازة",
  day_off: "يوم راحة",
  advance: "سلفة",
  equipment: "معدات",
  other: "أخرى",
};

const statusMap: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "قيد الانتظار", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  approved: { label: "موافق عليه", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "مرفوض", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

type RequestRow = {
  id: string;
  request_type: RequestType;
  description: string;
  requested_date: string | null;
  status: RequestStatus;
  created_at: string;
  requester: { full_name: string } | null;
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireFeature("requests");
  const isManager = profile.role !== "employee";

  const sp = await searchParams;
  const filterStatus = typeof sp.status === "string" ? sp.status : "";
  const filterType = typeof sp.type === "string" ? sp.type : "";

  const requests = await getRequestsData({
    profileId: profile.id ?? "",
    isManager,
    filterStatus: filterStatus || undefined,
    filterType: filterType || undefined,
  });

  return (
    <div>
      <PageHeader
        title="الطلبات"
        description={isManager ? "طلبات المهندسين — راجع وأدر الطلبات." : "طلباتي — إجازة، سلفة، أو غيرها."}
        action={
          !isManager ? (
            <Link href="/portal/requests/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700">
              <Plus className="w-4 h-4" />
              طلب جديد
            </Link>
          ) : null
        }
      />

      <RequestsFilter isManager={isManager} currentStatus={filterStatus} currentType={filterType} />

      {requests.length === 0 ? (
        <EmptyState icon={ClipboardEdit} title="لا توجد طلبات" description={filterStatus || filterType ? "لا توجد طلبات تطابق الفلتر." : "لم يتم تقديم طلبات بعد."} />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const { label: sLabel, cls: sCls } = statusMap[r.status];
            return (
              <Link key={r.id} href={`/portal/requests/${r.id}`} className="flex items-start gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-primary-700 transition-all">
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ClipboardEdit className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{typeLabels[r.request_type]}</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sCls}`}>{sLabel}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{r.description}</p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {r.requested_date ? <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"><CalendarDays className="w-3.5 h-3.5" />{r.requested_date}</span> : null}
                    {isManager && r.requester ? <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"><User className="w-3.5 h-3.5" />{r.requester.full_name}</span> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
