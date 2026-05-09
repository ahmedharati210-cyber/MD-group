import Link from "next/link";
import { CalendarCheck, Download, Clock, Plus } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { getEmployeeAttendance, getManagerAttendanceData } from "@/lib/data/attendance";
import { PageHeader } from "@/components/portal/PageHeader";
import { EmptyState } from "@/components/portal/EmptyState";
import { formatDate, formatTime } from "@/lib/utils";
import { CheckInPanel } from "./check-in-panel";
import { DailyGrid } from "./daily-grid";

export const metadata = { title: "الحضور" };

type SearchParams = Promise<{ date?: string; companyId?: string }>;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, profile } = await requireFeature("attendance");
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = params.date ?? today;

  if (profile.role === "employee") {
    const mine = await getEmployeeAttendance(userId);
    const todays = mine.find((r) => r.date === today) ?? null;

    return (
      <div>
        <PageHeader
          title="الحضور"
          description="تسجيل الحضور اليومي ومتابعة سجلاتك."
        />
        <CheckInPanel
          checkedIn={!!todays?.check_in}
          checkedOut={!!todays?.check_out}
          checkIn={todays?.check_in ?? null}
          checkOut={todays?.check_out ?? null}
        />
        <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-50 mb-3 mt-6 sm:mt-8">
          آخر 30 سجل
        </h2>
        {mine.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="لا يوجد سجل بعد"
            description="سجّل حضورك اليوم لتبدأ."
          />
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {mine.map((a) => (
                <div
                  key={a.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {formatDate(a.date)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {a.check_in ? formatTime(a.check_in) : "—"}
                      {" → "}
                      {a.check_out ? formatTime(a.check_out) : "—"}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-right text-gray-600 dark:text-gray-400">
                    <th className="px-5 py-3 font-semibold">التاريخ</th>
                    <th className="px-5 py-3 font-semibold">الحضور</th>
                    <th className="px-5 py-3 font-semibold">الانصراف</th>
                    <th className="px-5 py-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {mine.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-3 text-gray-800 dark:text-gray-200">
                        {formatDate(a.date)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                          {a.check_in ? formatTime(a.check_in) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {a.check_out ? formatTime(a.check_out) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // Manager / admin view — daily grid
  const { employees, companies, rows } = await getManagerAttendanceData(
    selectedDate,
    params.companyId,
  );

  return (
    <div>
      <PageHeader
        title="سجل الحضور"
        description="عرض وإدارة الحضور اليومي للموظفين."
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link
              href={`/portal/attendance/new?date=${selectedDate}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-primary-700 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              إضافة سجل
            </Link>
            <Link
              href={`/api/attendance/export?date=${selectedDate}${
                params.companyId ? `&companyId=${params.companyId}` : ""
              }`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-800 dark:hover:bg-white w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </Link>
          </div>
        }
      />

      <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-5">
        <input
          type="date"
          name="date"
          defaultValue={selectedDate}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
        />
        {profile.role === "md_admin" ? (
          <select
            name="companyId"
            defaultValue={params.companyId ?? ""}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none"
          >
            <option value="">كل الشركات</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="submit"
          className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700"
        >
          عرض
        </button>
      </form>

      {employees.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="لا يوجد موظفون"
          description="أضف موظفين أولاً لعرض الحضور."
        />
      ) : (
        <DailyGrid
          date={selectedDate}
          employees={employees}
          records={rows.map((r) => ({
            id: r.id,
            profile_id: r.profile_id,
            status: r.status,
            check_in: r.check_in,
            check_out: r.check_out,
          }))}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    present:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    late: "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    absent: "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    leave: "bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  };
  const label: Record<string, string> = {
    present: "حاضر",
    late: "متأخر",
    absent: "غائب",
    leave: "إجازة",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
        map[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}
