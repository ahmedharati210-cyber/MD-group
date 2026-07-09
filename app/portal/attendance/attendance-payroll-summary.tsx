import type { BranchPayrollTotals, PersonPayrollSummary } from "@/lib/attendance/attendance-view";
import { formatDeductionHours } from "@/lib/attendance/attendance-view";

type Props = {
  rows: PersonPayrollSummary[];
  totals: BranchPayrollTotals;
};

function hours(minutes: number): string {
  return formatDeductionHours(minutes);
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-gray-50 dark:bg-gray-800/60">
            <tr className="text-right">
              <th className="px-3 py-3">الموظف</th>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">حضور</th>
              <th className="px-3 py-3">غياب</th>
              <th className="px-3 py-3">بصمة واحدة</th>
              <th className="px-3 py-3">إجازات</th>
              <th className="px-3 py-3">تأخير</th>
              <th className="px-3 py-3">خروج مبكر</th>
              <th className="px-3 py-3">إضافي</th>
              <th className="px-3 py-3">دوام كامل</th>
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
                <td className="px-3 py-2.5">{row.presentDays}</td>
                <td className="px-3 py-2.5 text-red-600">{row.absentDays}</td>
                <td className="px-3 py-2.5 text-orange-600">{row.onePunchDays}</td>
                <td className="px-3 py-2.5 text-teal-600">{row.leaveDays}</td>
                <td className="px-3 py-2.5 text-amber-600">{row.lateDays}</td>
                <td className="px-3 py-2.5">{row.earlyLeaveDays}</td>
                <td className="px-3 py-2.5 text-emerald-600">{row.overtimeDays}</td>
                <td className="px-3 py-2.5">{row.fullTimeDays}</td>
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
              <td className="px-3 py-3">{totals.presentDays}</td>
              <td className="px-3 py-3">{totals.absentDays}</td>
              <td className="px-3 py-3">{totals.onePunchDays}</td>
              <td className="px-3 py-3">{totals.leaveDays}</td>
              <td className="px-3 py-3">{totals.lateDays}</td>
              <td className="px-3 py-3">{totals.earlyLeaveDays}</td>
              <td className="px-3 py-3">{totals.overtimeDays}</td>
              <td className="px-3 py-3">{totals.fullTimeDays}</td>
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
    </div>
  );
}
