import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  FileText,
  Pencil,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/portal/PageHeader";
import { DeleteButton } from "@/components/portal/DeleteButton";
import { formatDate, formatTime } from "@/lib/utils";
import { deleteEmployeeAction } from "../actions";

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId, profile: me } = await requireUser();
  const { id } = await params;
  const { error: errorMessage } = await searchParams;

  // Employees can only view their own profile.
  if (me.role === "employee" && id !== me.id) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("profiles")
    .select("*, companies(id, name_ar)")
    .eq("id", id)
    .single();

  if (!person) notFound();

  const [{ data: attendance }, { data: docs }] = await Promise.all([
    supabase
      .from("attendance")
      .select("*")
      .eq("profile_id", id)
      .order("date", { ascending: false })
      .limit(20),
    supabase
      .from("documents")
      .select("id, title, category, created_at")
      .eq("owner_profile_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const company = (
    person as typeof person & {
      companies?: { id: string; name_ar: string } | null;
    }
  ).companies;

  const canManage =
    me.role === "md_admin" ||
    (me.role === "company_manager" &&
      person.company_id === me.company_id &&
      person.role === "employee");
  const canDelete = canManage && person.id !== userId;

  return (
    <div>
      {me.role !== "employee" ? (
        <Link
          href="/portal/employees"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى القائمة
        </Link>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <PageHeader
          title={person.full_name}
          description={person.job_title ?? undefined}
        />
        {canManage ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/employees/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Pencil className="w-4 h-4" />
              تعديل
            </Link>
            {canDelete ? (
              <DeleteButton
                action={deleteEmployeeAction}
                id={id}
                confirmText="سيتم حذف الحساب وبياناته. هل تريد المتابعة؟"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <InfoRow label="الشركة" value={company?.name_ar ?? "—"} icon={Building2} />
        <InfoRow
          label="تاريخ التوظيف"
          value={formatDate(person.hired_at) || "—"}
          icon={CalendarCheck}
        />
        <InfoRow label="الحالة" value={person.is_active ? "نشط" : "غير نشط"} />
        <InfoRow label="الهاتف" value={person.phone ?? "—"} />
        <InfoRow label="الرقم الوطني" value={person.national_id ?? "—"} />
        <InfoRow
          label="الدور"
          value={
            person.role === "md_admin"
              ? "مدير مجموعة"
              : person.role === "company_manager"
                ? "مدير شركة"
                : "موظف"
          }
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              آخر سجلات الحضور
            </h2>
          </div>
          {!attendance || attendance.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              لا يوجد سجل بعد.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {attendance.map((a) => (
                <li
                  key={a.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-sm flex-wrap"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatDate(a.date)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {a.check_in ? formatTime(a.check_in) : "—"}
                    {" → "}
                    {a.check_out ? formatTime(a.check_out) : "—"}
                  </span>
                  <span
                    className={
                      a.status === "present"
                        ? "text-emerald-600 dark:text-emerald-400 text-xs font-semibold"
                        : a.status === "late"
                          ? "text-amber-600 dark:text-amber-400 text-xs font-semibold"
                          : "text-gray-500 dark:text-gray-400 text-xs font-semibold"
                    }
                  >
                    {a.status === "present"
                      ? "حاضر"
                      : a.status === "late"
                        ? "متأخر"
                        : a.status === "absent"
                          ? "غائب"
                          : "إجازة"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              الملفات الشخصية
            </h2>
          </div>
          {!docs || docs.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              لا توجد ملفات شخصية.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {docs.map((d) => (
                <li key={d.id} className="py-2.5">
                  <Link
                    href={`/portal/papers/${d.id}`}
                    className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-primary-700 dark:hover:text-primary-400"
                  >
                    {d.title}
                  </Link>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {d.category} • {formatDate(d.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Building2;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 sm:p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
        {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
        {value}
      </div>
    </div>
  );
}
