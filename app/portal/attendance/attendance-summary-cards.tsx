import { CalendarOff, Clock3, Palmtree, UserCheck, UserX, Users, AlertTriangle } from "lucide-react";
import type { MonthSummary, PersonMonthStats } from "@/lib/attendance/attendance-view";
import { formatDeductionHours } from "@/lib/attendance/attendance-view";

type Props = {
  summary: MonthSummary;
};

const cards = [
  {
    key: "totalPeople",
    label: "عدد الأشخاص",
    icon: Users,
    color: "text-sky-600 bg-sky-50 dark:bg-sky-900/20",
  },
  {
    key: "presentDays",
    label: "أيام حضور",
    icon: UserCheck,
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    key: "absentDays",
    label: "أيام غياب",
    icon: UserX,
    color: "text-red-600 bg-red-50 dark:bg-red-900/20",
  },
  {
    key: "lateDays",
    label: "أيام تأخير",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "deduction",
    label: "ساعات الخصم",
    icon: Clock3,
    color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  },
] as const;

export function AttendanceSummaryCards({ summary }: Props) {
  const values: Record<string, string | number> = {
    totalPeople: summary.totalPeople,
    presentDays: summary.presentDays,
    absentDays: summary.absentDays,
    lateDays: summary.lateDays,
    deduction: formatDeductionHours(summary.totalDeductionMinutes),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
          >
            <div className={`inline-flex p-2 rounded-xl mb-2 ${card.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {values[card.key]}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}

const personCards = [
  {
    key: "presentDays",
    label: "أيام حضور",
    icon: UserCheck,
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    key: "absentDays",
    label: "غياب / لم يظهر",
    icon: UserX,
    color: "text-red-600 bg-red-50 dark:bg-red-900/20",
  },
  {
    key: "onePunchDays",
    label: "بصمة واحدة",
    icon: Clock3,
    color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  },
  {
    key: "lateDays",
    label: "أيام تأخير",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "weekendDays",
    label: "عطلات",
    icon: CalendarOff,
    color: "text-green-600 bg-green-50 dark:bg-green-900/20",
  },
  {
    key: "leaveDays",
    label: "إجازات",
    icon: Palmtree,
    color: "text-teal-600 bg-teal-50 dark:bg-teal-900/20",
  },
] as const;

export function AttendancePersonSummaryCards({
  stats,
  compact = false,
}: {
  stats: PersonMonthStats;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        {personCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2 flex items-center gap-2"
            >
              <div className={`inline-flex p-1.5 rounded-lg shrink-0 ${card.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight">
                  {stats[card.key]}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {card.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
      {personCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
          >
            <div className={`inline-flex p-2 rounded-xl mb-2 ${card.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {stats[card.key]}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
