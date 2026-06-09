import Link from "next/link";
import { AlertTriangle, Bell, Plus, User, Building2, Inbox, Settings2 } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWarningsData,
  getManagerInboxData,
  type WarningRow,
  type NotificationRecipient,
} from "@/lib/data/warnings";
import { countRecipientUnread } from "@/lib/data/notification-badge-counts";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { SendWarningForm } from "@/components/warnings/SendWarningForm";
import { MarkReadButton } from "@/components/warnings/MarkReadButton";
import { MarkAllReadButton } from "@/components/warnings/MarkAllReadButton";
import { DeleteWarningButton } from "@/components/warnings/DeleteWarningButton";
import { formatDate, cn } from "@/lib/utils";

export const metadata = { title: "مركز الإشعارات" };

const PAGE_SIZE = 20;

type SearchParams = Promise<{ page?: string; companyId?: string; tab?: string }>;

function tabHref(tab: "inbox" | "manage", companyId: string | null) {
  const q = new URLSearchParams({ tab });
  if (companyId) q.set("companyId", companyId);
  return `/portal/notifications?${q.toString()}`;
}

function NotificationCard({
  w,
  isRecipientView,
  showSender,
  showDelete,
}: {
  w: WarningRow;
  isRecipientView: boolean;
  showSender: boolean;
  showDelete: boolean;
}) {
  const isWarning = w.kind === "warning";
  const isNew = !w.is_read && isRecipientView;
  const Icon = isWarning ? AlertTriangle : Bell;
  const cardCls = isNew
    ? isWarning
      ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
      : "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800"
    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800";
  const iconWrapCls = isNew
    ? isWarning
      ? "bg-red-100 dark:bg-red-900/30"
      : "bg-orange-100 dark:bg-orange-900/30"
    : isWarning
      ? "bg-red-50 dark:bg-red-900/20"
      : "bg-orange-50 dark:bg-orange-900/20";
  const iconCls = isWarning
    ? "text-red-600 dark:text-red-400"
    : "text-orange-600 dark:text-orange-400";
  const newBadgeCls = iconCls;

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-2xl border p-4 shadow-xs transition-all",
        cardCls,
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          iconWrapCls,
        )}
      >
        <Icon className={cn("w-5 h-5", iconCls)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span
            className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-md",
              isWarning
                ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
            )}
          >
            {isWarning ? "إنذار" : "إشعار"}
          </span>
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {w.message}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {w.target ? (
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <User className="w-3.5 h-3.5" />
              {w.target.full_name}
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">إلى الجميع</span>
          )}
          {showSender && w.sender ? (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              من: {w.sender.full_name}
            </span>
          ) : null}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(w.created_at)}
          </span>
          {!w.is_read && isRecipientView ? (
            <span className={cn("text-xs font-semibold", newBadgeCls)}>جديد</span>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {!w.is_read && isRecipientView ? <MarkReadButton warningId={w.id} /> : null}
        {showDelete ? <DeleteWarningButton warningId={w.id} /> : null}
      </div>
    </div>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { profile } = await requireFeature("warnings");
  const isEmployee = profile.role === "employee";
  const isOwner = profile.role === "owner";
  const isSuperAdmin = profile.is_super_admin ?? false;
  const isManager = !isEmployee && !isOwner;
  const canReceiveInbox = isManager && !isSuperAdmin;
  const activeTab =
    canReceiveInbox && sp.tab === "inbox" ? ("inbox" as const) : ("manage" as const);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const scopeId = await getShellCompanyIdForProfile(profile);

  const companyIdParam =
    typeof sp.companyId === "string" && sp.companyId.trim()
      ? sp.companyId.trim()
      : null;

  const filterCompanyId =
    profile.role === "company_manager" ? scopeId ?? null : companyIdParam;

  let warnings: WarningRow[] = [];
  let totalCount = 0;
  let engineers: { id: string; full_name: string }[] | null = null;
  let managers: NotificationRecipient[] | null = null;
  let companies: { id: string; name_ar: string }[] | null = null;

  if (canReceiveInbox && activeTab === "inbox") {
    const inbox = await getManagerInboxData({
      profileId: profile.id ?? "",
      page,
      pageSize: PAGE_SIZE,
    });
    warnings = inbox.warnings;
    totalCount = inbox.totalCount;
  } else {
    const data = await getWarningsData({
      profileId: profile.id ?? "",
      filterCompanyId,
      role: profile.role,
      isSuperAdmin,
      page,
      pageSize: PAGE_SIZE,
    });
    warnings = data.warnings;
    totalCount = data.totalCount;
    engineers = data.engineers;
    managers = data.managers;
    companies = data.companies;
  }

  let recipientUnreadCount = 0;
  if ((isEmployee || canReceiveInbox) && profile.id) {
    const supabase = await createSupabaseServerClient();
    recipientUnreadCount = await countRecipientUnread({
      supabase,
      userId: profile.id,
      isEmployee,
      role: profile.role,
      isSuperAdmin,
    });
  }

  const isRecipientView = isEmployee || (canReceiveInbox && activeTab === "inbox");
  const showCompanyFilter =
    activeTab === "manage" &&
    !isEmployee &&
    (isSuperAdmin || profile.role === "md_admin" || isOwner);

  const paginationExtra: Record<string, string> = {
    ...(canReceiveInbox ? { tab: activeTab } : {}),
    ...(filterCompanyId && activeTab === "manage" ? { companyId: filterCompanyId } : {}),
  };

  const selectClasses =
    "px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-hidden";

  return (
    <div>
      <PageHeader
        title="مركز الإشعارات"
        description={
          isEmployee
            ? "الإنذارات والإشعارات الموجهة إليك."
            : isOwner
              ? "عرض الإنذارات والإشعارات لجميع الشركات."
              : canReceiveInbox && activeTab === "inbox"
                ? "الإنذارات والإشعارات الموجهة إليك."
                : "أرسل إنذارات أو إشعارات للموظفين والمديرين."
        }
        action={
          isRecipientView && recipientUnreadCount > 0 ? (
            <MarkAllReadButton />
          ) : undefined
        }
      />

      {canReceiveInbox ? (
        <div className="flex gap-2 mb-6 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
          <Link
            href={tabHref("inbox", filterCompanyId)}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              activeTab === "inbox"
                ? "bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 shadow-xs"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80",
            )}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            بريدي الوارد
            {recipientUnreadCount > 0 ? (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {recipientUnreadCount > 99 ? "99+" : recipientUnreadCount}
              </span>
            ) : null}
          </Link>
          <Link
            href={tabHref("manage", filterCompanyId)}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              activeTab === "manage"
                ? "bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 shadow-xs"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/80",
            )}
          >
            <Settings2 className="w-4 h-4 shrink-0" />
            إدارة
          </Link>
        </div>
      ) : null}

      {showCompanyFilter && (companies?.length ?? 0) > 0 ? (
        <form
          method="get"
          className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-6"
        >
          <input type="hidden" name="tab" value="manage" />
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 sm:mr-2">
            <Building2 className="w-4 h-4" />
            <span className="font-medium">الشركة</span>
          </div>
          <select
            name="companyId"
            defaultValue={companyIdParam ?? ""}
            className={`flex-1 min-w-48 ${selectClasses}`}
          >
            <option value="">كل الشركات</option>
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white"
          >
            تصفية
          </button>
        </form>
      ) : null}

      {isManager && activeTab === "manage" ? (
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> إرسال جديد
          </h2>
          <SendWarningForm
            engineers={engineers ?? []}
            managers={managers ?? []}
            senderShellCompanyId={scopeId ?? ""}
            canBroadcast={isSuperAdmin}
            companies={companies ?? []}
          />
        </div>
      ) : null}

      {warnings.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={activeTab === "inbox" ? "لا توجد رسائل في بريدك" : "لا توجد إشعارات"}
          description={
            activeTab === "inbox"
              ? "لم يصلك أي إنذار أو إشعار بعد."
              : "لا توجد إنذارات أو إشعارات حتى الآن."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {warnings.map((w) => (
              <NotificationCard
                key={w.id}
                w={w}
                isRecipientView={isRecipientView}
                showSender={!isEmployee || activeTab === "inbox"}
                showDelete={isManager && activeTab === "manage"}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            baseUrl="/portal/notifications"
            extraParams={paginationExtra}
          />
        </>
      )}
    </div>
  );
}
