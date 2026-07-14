import type { BranchPayrollTotals, PersonPayrollSummary } from "@/lib/attendance/attendance-view";
import { formatDeductionHours } from "@/lib/attendance/attendance-view";

type Props = {
  rows: PersonPayrollSummary[];
  totals: BranchPayrollTotals;
};

function hours(minutes: number): string {
  return formatDeductionHours(minutes);
}

type StatField = {
  label: string;
  value: string | number;
  valueClassName?: string;
};

function buildRowStats(row: PersonPayrollSummary): StatField[] {
  return [
    { label: "عدد ايام الدوام الكامل", value: row.fullTimeDays },
    { label: "غياب", value: row.absentDays, valueClassName: "text-red-600" },
    { label: "بصمة واحدة", value: row.onePunchDays, valueClassName: "text-orange-600" },
    { label: "إجازات", value: row.leaveDays, valueClassName: "text-teal-600" },
    { label: "تأخير", value: row.lateDays, valueClassName: "text-amber-600" },
    { label: "عدد ايام الخروج المبكر", value: row.earlyLeaveDays },
    { label: "إضافي", value: row.overtimeDays, valueClassName: "text-emerald-600" },
    { label: "ساعات العمل", value: hours(row.totalWorkedMinutes), valueClassName: "font-mono text-xs" },
    { label: "المطلوب", value: hours(row.totalExpectedMinutes), valueClassName: "font-mono text-xs" },
    {
      label: "تأخير (س)",
      value: hours(row.totalLateMinutes),
      valueClassName: "font-mono text-xs text-amber-700",
    },
    {
      label: "خروج مبكر (س)",
      value: hours(row.totalEarlyLeaveMinutes),
      valueClassName: "font-mono text-xs",
    },
    {
      label: "إضافي (س)",
      value: hours(row.totalOvertimeMinutes),
      valueClassName: "font-mono text-xs text-emerald-700",
    },
    {
      label: "الخصم",
      value: hours(row.totalDeductionMinutes),
      valueClassName: "font-mono text-xs text-violet-700 font-semibold",
    },
  ];
}

function buildTotalsStats(totals: BranchPayrollTotals): StatField[] {
  return [
    { label: "عدد ايام الدوام الكامل", value: totals.fullTimeDays },
    { label: "غياب", value: totals.absentDays },
    { label: "بصمة واحدة", value: totals.onePunchDays },
    { label: "إجازات", value: totals.leaveDays },
    { label: "تأخير", value: totals.lateDays },
    { label: "عدد ايام الخروج المبكر", value: totals.earlyLeaveDays },
    { label: "إضافي", value: totals.overtimeDays },
    { label: "ساعات العمل", value: hours(totals.totalWorkedMinutes), valueClassName: "font-mono text-xs" },
    { label: "المطلوب", value: hours(totals.totalExpectedMinutes), valueClassName: "font-mono text-xs" },
    { label: "تأخير (س)", value: hours(totals.totalLateMinutes), valueClassName: "font-mono text-xs" },
    {
      label: "خروج مبكر (س)",
      value: hours(totals.totalEarlyLeaveMinutes),
      valueClassName: "font-mono text-xs",
    },
    { label: "إضافي (س)", value: hours(totals.totalOvertimeMinutes), valueClassName: "font-mono text-xs" },
    {
      label: "الخصم",
      value: hours(totals.totalDeductionMinutes),
      valueClassName: "font-mono text-xs text-violet-700 font-semibold",
    },
  ];
}

function StatGrid({ stats }: { stats: StatField[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col min-w-0">
          <dt className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</dt>
          <dd
            className={`font-medium ${stat.valueClassName ?? ""}`}
            dir={stat.valueClassName?.includes("font-mono") ? "ltr" : undefined}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PayrollMobileCard({
  title,
  subtitle,
  stats,
  emphasized = false,
}: {
  title: string;
  subtitle?: string;
  stats: StatField[];
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 space-y-3 ${
        emphasized
          ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/60"
          : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
      }`}
    >
      <div>
        <p className="font-semibold text-sm">{title}</p>
        {subtitle ? (
          <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
            {subtitle}
          </p>
        ) : null}
      </div>
      <StatGrid stats={stats} />
    </div>
  );
}

export function AttendancePayrollSummary({ rows, totals }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        لا توجد سجلات لعرض الملخص.
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-right">
              <th className="px-3 py-3">الموظف</th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">عدد ايام الدوام الكامل</th>
              <th className="px-3 py-3">غياب</th>
              <th className="px-3 py-3">بصمة واحدة</th>
              <th className="px-3 py-3">إجازات</th>
              <th className="px-3 py-3">تأخير</th>
              <th className="px-3 py-3">عدد ايام الخروج المبكر</th>
              <th className="px-3 py-3">إضافي</th>
              <th className="px-3 py-3">ساعات العمل</th>
              <th className="px-3 py-3">المطلوب</th>
              <th className="px-3 py-3">تأخير (س)</th>
              <th className="px-3 py-3">خروج مبكر (س)</th>
              <th className="px-3 py-3">إضافي (س)</th>
              <th className="px-3 py-3">الخصم</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.externalEmployeeNumber}-${row.personId ?? "x"}`}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-3 py-2.5 font-medium">{row.employeeName}</td>
                <td className="px-3 py-2.5 text-gray-500" dir="ltr">
                  {row.externalEmployeeNumber}
                </td>
                <td className="px-3 py-2.5">{row.fullTimeDays}</td>
                <td className="px-3 py-2.5 text-red-600">{row.absentDays}</td>
                <td className="px-3 py-2.5 text-orange-600">{row.onePunchDays}</td>
                <td className="px-3 py-2.5 text-teal-600">{row.leaveDays}</td>
                <td className="px-3 py-2.5 text-amber-600">{row.lateDays}</td>
                <td className="px-3 py-2.5">{row.earlyLeaveDays}</td>
                <td className="px-3 py-2.5 text-emerald-600">{row.overtimeDays}</td>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                  {hours(row.totalWorkedMinutes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                  {hours(row.totalExpectedMinutes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-amber-700" dir="ltr">
                  {hours(row.totalLateMinutes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                  {hours(row.totalEarlyLeaveMinutes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-emerald-700" dir="ltr">
                  {hours(row.totalOvertimeMinutes)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-violet-700 font-semibold" dir="ltr">
                  {hours(row.totalDeductionMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800/60 font-semibold border-t-2 border-gray-200 dark:border-gray-700">
            <tr>
              <td className="px-3 py-3" colSpan={2}>
                الإجمالي
              </td>
              <td className="px-3 py-3">{totals.fullTimeDays}</td>
              <td className="px-3 py-3">{totals.absentDays}</td>
              <td className="px-3 py-3">{totals.onePunchDays}</td>
              <td className="px-3 py-3">{totals.leaveDays}</td>
              <td className="px-3 py-3">{totals.lateDays}</td>
              <td className="px-3 py-3">{totals.earlyLeaveDays}</td>
              <td className="px-3 py-3">{totals.overtimeDays}</td>
              <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                {hours(totals.totalWorkedMinutes)}
              </td>
              <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                {hours(totals.totalExpectedMinutes)}
              </td>
              <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                {hours(totals.totalLateMinutes)}
              </td>
              <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                {hours(totals.totalEarlyLeaveMinutes)}
              </td>
              <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                {hours(totals.totalOvertimeMinutes)}
              </td>
              <td className="px-3 py-3 font-mono text-xs text-violet-700" dir="ltr">
                {hours(totals.totalDeductionMinutes)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-3">
        {rows.map((row) => (
          <PayrollMobileCard
            key={`mobile-${row.externalEmployeeNumber}-${row.personId ?? "x"}`}
            title={row.employeeName}
            subtitle={`#${row.externalEmployeeNumber}`}
            stats={buildRowStats(row)}
          />
        ))}
        <PayrollMobileCard
          title="الإجمالي"
          stats={buildTotalsStats(totals)}
          emphasized
        />
      </div>
    </div>
  );
}
