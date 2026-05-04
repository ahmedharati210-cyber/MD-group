import Link from "next/link";
import { ScrollText, ArrowRight, User, Calendar } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "سجل التدقيق" };

const PAGE_SIZE = 50;

type SearchParams = Promise<{ entity?: string; action?: string; actorId?: string; page?: string }>;

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
};

// ---------------------------------------------------------------------------
// Label / badge maps
// ---------------------------------------------------------------------------

const actionBadge: Record<string, string> = {
  create:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  update:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  delete:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  upload:  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  login:   "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  view:    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
};

// All known action keys — shown in the filter regardless of current data
const KNOWN_ACTIONS: { value: string; label: string }[] = [
  { value: "create", label: "إنشاء" },
  { value: "update", label: "تحديث" },
  { value: "delete", label: "حذف" },
  { value: "view",   label: "عرض" },
  { value: "upload", label: "رفع" },
  { value: "login",  label: "تسجيل دخول" },
];

const entityLabels: Record<string, string> = {
  // Our format (singular)
  document:         "وثيقة",
  profile:          "مستخدم",
  company:          "شركة",
  attendance:       "حضور",
  project:          "مشروع",
  project_task:     "مهمة",
  project_category: "مرحلة مشروع",
  contact:          "جهة اتصال",
  mail:             "بريد",
  warning:          "إنذار",
  claim:            "مطالبة",
  report:           "تقرير",
  request:          "طلب",
  map:              "خريطة",
  // DB-trigger format (plural / legacy)
  documents:        "وثيقة",
  profiles:         "مستخدم",
  employee:         "موظف",
};

// All known entity keys — shown in the filter regardless of current data
const KNOWN_ENTITIES: { value: string; label: string }[] = [
  { value: "project",          label: "مشروع" },
  { value: "project_task",     label: "مهمة" },
  { value: "project_category", label: "مرحلة مشروع" },
  { value: "report",           label: "تقرير" },
  { value: "request",          label: "طلب" },
  { value: "claim",            label: "مطالبة" },
  { value: "map",              label: "خريطة" },
  { value: "warning",          label: "إنذار" },
  { value: "contact",          label: "جهة اتصال" },
  { value: "mail",             label: "بريد" },
  { value: "attendance",       label: "حضور" },
  { value: "profile",          label: "مستخدم" },
  { value: "document",         label: "وثيقة" },
];

// ---------------------------------------------------------------------------
// Helper: DB triggers write "employee.create" into the `action` column.
// Parse those into separate action / entity display values.
// ---------------------------------------------------------------------------
function parseRow(row: AuditRow): { actionKey: string; entityKey: string } {
  if (row.action.includes(".")) {
    const [ent, act] = row.action.split(".");
    return { actionKey: act ?? row.action, entityKey: ent ?? row.entity };
  }
  return { actionKey: row.action, entityKey: row.entity };
}

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, payload, created_at, actor:actor_id(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Use ilike for action so "create" matches both new "create" and legacy "employee.create"
  if (sp.action)  query = query.ilike("action",  `%${sp.action}%`);
  if (sp.entity)  query = query.or(`entity.eq.${sp.entity},action.ilike.${sp.entity}.%`);
  if (sp.actorId) query = query.eq("actor_id", sp.actorId);

  const { data: rawRows, count } = await query;
  const rows = (rawRows ?? []) as unknown as AuditRow[];
  const totalCount = count ?? 0;

  const { data: actors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  const selectCls =
    "px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none";

  return (
    <div>
      <PageHeader
        title="سجل التدقيق"
        description="سجل كامل لجميع العمليات — الإنشاء، التعديل، الحذف، والعرض."
        action={
          <Link
            href="/portal/admin"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للإدارة
          </Link>
        }
      />

      <form method="get" className="flex flex-wrap gap-3 mb-6">
        {/* Action filter — hardcoded, always shows all known actions */}
        <select name="action" defaultValue={sp.action ?? ""} className={selectCls}>
          <option value="">كل الإجراءات</option>
          {KNOWN_ACTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Entity filter — hardcoded, always shows all known entities */}
        <select name="entity" defaultValue={sp.entity ?? ""} className={selectCls}>
          <option value="">كل الكيانات</option>
          {KNOWN_ENTITIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Actor filter */}
        <select name="actorId" defaultValue={sp.actorId ?? ""} className={selectCls}>
          <option value="">كل المستخدمين</option>
          {(actors ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.full_name}</option>
          ))}
        </select>

        <button
          type="submit"
          className="px-4 py-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-700 dark:hover:bg-gray-300"
        >
          تصفية
        </button>
        {(sp.entity || sp.action || sp.actorId) ? (
          <Link
            href="/portal/admin/audit"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            مسح
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="لا توجد سجلات" description="لم تُجرَ أي عمليات مطابقة بعد." />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-4 py-3 font-semibold">الإجراء</th>
                    <th className="px-4 py-3 font-semibold">الكيان</th>
                    <th className="px-4 py-3 font-semibold">المستخدم</th>
                    <th className="px-4 py-3 font-semibold">التاريخ والوقت</th>
                    <th className="px-4 py-3 font-semibold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row) => {
                    const { actionKey, entityKey } = parseRow(row);
                    const badgeCls = actionBadge[actionKey] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
                    const actionLabel = KNOWN_ACTIONS.find((a) => a.value === actionKey)?.label ?? actionKey;
                    const entityLabel = entityLabels[entityKey] ?? entityKey;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeCls}`}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                          {entityLabel}
                        </td>
                        <td className="px-4 py-3">
                          {row.actor ? (
                            <span className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              {row.actor.full_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">النظام</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            {formatDate(row.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.entity_id ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono" dir="ltr">
                              {row.entity_id.slice(0, 8)}…
                            </span>
                          ) : null}
                          {row.payload && Object.keys(row.payload).length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(row.payload).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5"
                                >
                                  <span className="text-gray-400 dark:text-gray-500">{k}:</span>{" "}
                                  <span className="font-medium">{String(v)}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            page={page}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            baseUrl="/portal/admin/audit"
            extraParams={{
              ...(sp.entity  ? { entity:  sp.entity  } : {}),
              ...(sp.action  ? { action:  sp.action  } : {}),
              ...(sp.actorId ? { actorId: sp.actorId } : {}),
            }}
          />
        </>
      )}
    </div>
  );
}
