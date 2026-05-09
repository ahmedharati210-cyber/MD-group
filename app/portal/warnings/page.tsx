import { AlertTriangle, Plus, User } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getWarningsData } from "@/lib/data/warnings";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { SendWarningForm } from "@/components/warnings/SendWarningForm";
import { MarkReadButton } from "@/components/warnings/MarkReadButton";
import { DeleteWarningButton } from "@/components/warnings/DeleteWarningButton";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "الإنذارات" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string }>;

type WarningRow = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  target: { full_name: string } | null;
  sender: { full_name: string } | null;
};

export default async function WarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const { profile } = await requireFeature("warnings");
  const isManager = profile.role !== "employee";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const { warnings, totalCount, engineers, companies } = await getWarningsData({
    profileId: profile.id ?? "",
    companyId: profile.company_id,
    role: profile.role,
    isSuperAdmin: profile.is_super_admin ?? false,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="الإنذارات"
        description={isManager ? "أرسل إنذارات للمهندسين." : "الإنذارات الموجهة إليك."}
      />

      {isManager ? (
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> إرسال إنذار جديد
          </h2>
          <SendWarningForm
            engineers={engineers ?? []}
            canBroadcast={profile.is_super_admin ?? false}
            companies={companies ?? []}
          />
        </div>
      ) : null}

      {warnings.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="لا توجد إنذارات" description="لا توجد إنذارات حتى الآن." />
      ) : (
        <>
        <div className="space-y-3">
          {warnings.map((w) => (
            <div
              key={w.id}
              className={`flex items-start gap-4 rounded-2xl border p-4 shadow-sm transition-all ${
                !w.is_read && !isManager
                  ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${!w.is_read && !isManager ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-50 dark:bg-amber-900/30"}`}>
                <AlertTriangle className={`w-5 h-5 ${!w.is_read && !isManager ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{w.message}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {w.target ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"><User className="w-3.5 h-3.5" />{w.target.full_name}</span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">إلى الجميع</span>
                  )}
                  {isManager && w.sender ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">من: {w.sender.full_name}</span>
                  ) : null}
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(w.created_at)}</span>
                  {!w.is_read ? (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">جديد</span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!w.is_read && !isManager ? <MarkReadButton warningId={w.id} /> : null}
                {isManager ? <DeleteWarningButton warningId={w.id} /> : null}
              </div>
            </div>
          ))}
        </div>
        <Pagination page={page} totalCount={totalCount} pageSize={PAGE_SIZE} baseUrl="/portal/warnings" />
        </>
      )}
    </div>
  );
}
