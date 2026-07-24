import Link from "next/link";
import { ScrollText, ArrowRight, User, Calendar } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { Pagination } from "@/components/portal/Pagination";
import { formatDateTime } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return UUID_RE.test(value.trim());
}

/** Hide ID-shaped payload keys whose values are UUIDs (legacy rows + technical fields). */
function shouldDisplayPayloadEntry(key: string, value: unknown): boolean {
  if (!looksLikeUuid(value)) return true;
  if (key === "id" || key.endsWith("_id")) return false;
  const hideUuidValueKeys = new Set([
    "profile_id",
    "auth_login_email",
    "broadcast_company",
    "broadcast_company_id",
    "company_id",
    "project_id",
    "category_id",
    "section_id",
    "invite_id",
    "entity_id",
  ]);
  return !hideUuidValueKeys.has(key);
}

const payloadKeyLabels: Record<string, string> = {
  report_date: "تاريخ التقرير",
  project_name: "المشروع",
  company_name: "الشركة",
  category_name: "المرحلة",
  name: "الاسم",
  status: "الحالة",
  title: "العنوان",
  titles: "العناوين",
  email: "البريد",
  recipients: "عدد المستلمين",
  removed_paths: "عدد الملفات المحذوفة",
  external_employee_number: "رقم الموظف",
  employee_name: "اسم المتقدّم",
  max_uses: "الحد الأقصى للاستخدام",
  token_expires_at: "انتهاء الصلاحية",
  is_completed: "مكتمل",
  full_name: "الاسم",
  request_type: "نوع الطلب",
  responded_at: "تاريخ الرد",
  is_active: "الحالة النشاط",
  role: "الدور",
  granted: "منح صلاحية سوبر أدمن",
  changed: "الحقول المُعدَّلة",
  features: "الميزات المُفعَّلة",
  company_id_changed: "تغيير الشركة",
  // Al Itqan / QA testing
  testing_access_enabled: "صلاحية المنظومات والمواقع",
  item_kind: "النوع",
  ready_for_test: "جاهز للاختبار",
  result: "النتيجة",
  reset: "إعادة فتح",
  convert: "تحويل النوع",
  reorder: "إعادة ترتيب",
  count: "العدد",
  description: "الوصف",
};

const payloadValueLabels: Record<string, string> = {
  true: "نعم",
  false: "لا",
  pass: "تم بنجاح",
  bug: "خلل",
  improve: "يحتاج تحسين",
  test: "اختبار",
  task: "مهمة",
  active: "نشط",
  done: "منتهٍ",
};

function formatPayloadValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "نعم" : "لا";
  }
  if (value === null || value === undefined) return "—";
  const raw = String(value);
  return payloadValueLabels[raw] ?? raw;
}

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
  qa_project:       "منصة",
  qa_section:       "قسم اختبار",
  qa_test_item:     "عنصر اختبار",
  // DB-trigger format (plural / legacy)
  documents:        "وثيقة",
  profiles:         "مستخدم",
  employee:         "موظف",
  employee_signup_invite:   "رابط تسجيل موظف",
  employee_signup_invites:  "رابط تسجيل موظف",
  employee_signup:          "طلب تسجيل موظف",
  employee_signup_requests: "طلب تسجيل موظف",
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
  { value: "company",          label: "شركة" },
  { value: "document",         label: "وثيقة" },
  { value: "qa_project",       label: "منصة" },
  { value: "qa_section",       label: "قسم اختبار" },
  { value: "qa_test_item",     label: "عنصر اختبار" },
  { value: "employee_signup_invite",   label: "رابط تسجيل موظف" },
  { value: "employee_signup_invites",  label: "رابط تسجيل موظف" },
  { value: "employee_signup_requests", label: "طلب تسجيل موظف" },
  { value: "employee_signup",          label: "طلب تسجيل موظف" },
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
    "px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-hidden";

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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs">
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
                    const payloadEntries =
                      row.payload && Object.keys(row.payload).length > 0
                        ? Object.entries(row.payload).filter(([k, v]) =>
                            shouldDisplayPayloadEntry(k, v),
                          )
                        : [];
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
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {formatDateTime(row.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {payloadEntries.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {payloadEntries.map(([k, v]) => (
                                <span
                                  key={k}
                                  className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xs px-1.5 py-0.5"
                                >
                                  <span className="text-gray-400 dark:text-gray-500">
                                    {payloadKeyLabels[k] ?? k}:
                                  </span>{" "}
                                  <span className="font-medium">
                                    {formatPayloadValue(v)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                          )}
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
