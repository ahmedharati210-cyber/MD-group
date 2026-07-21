"use client";

import { useState } from "react";
import {
  Clock3,
  Fingerprint,
  LogOut,
  UserCheck,
  UserX,
  Users,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { MonthSummary } from "@/lib/attendance/attendance-view";
import {
  filterPersonMetricDays,
  formatDeductionHours,
  metricTitleAr,
  type PersonMetricKey,
} from "@/lib/attendance/metric-drilldown";

type PersonMonthStats = {
  presentDays: number;
  absentDays: number;
  onePunchDays: number;
  lateDays: number;
  leaveDays: number;
  weekendDays: number;
  fullTimeDays: number;
  earlyLeaveDays: number;
  totalDeductionMinutes: number;
};
import type { AttendanceMonthlyRecord } from "@/types/db";
import { AttendanceMetricDrilldownModal } from "./attendance-metric-drilldown-modal";

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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
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

const personCards: Array<{
  key: PersonMetricKey;
  label: string;
  icon: LucideIcon;
  color: string;
}> = [
  {
    key: "fullTimeDays",
    label: "عدد ايام الدوام الكامل",
    icon: UserCheck,
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    key: "absentDays",
    label: "غياب",
    icon: UserX,
    color: "text-red-600 bg-red-50 dark:bg-red-900/20",
  },
  {
    key: "onePunchDays",
    label: "بصمة واحدة",
    icon: Fingerprint,
    color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  },
  {
    key: "lateDays",
    label: "أيام تأخير",
    icon: AlertTriangle,
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "earlyLeaveDays",
    label: "عدد ايام الخروج المبكر",
    icon: LogOut,
    color: "text-amber-700 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    key: "totalDeductionMinutes",
    label: "ساعات الخصم",
    icon: Clock3,
    color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  },
];

function personCardValues(stats: PersonMonthStats): Record<PersonMetricKey, string | number> {
  return {
    fullTimeDays: stats.fullTimeDays,
    absentDays: stats.absentDays,
    onePunchDays: stats.onePunchDays,
    lateDays: stats.lateDays,
    earlyLeaveDays: stats.earlyLeaveDays,
    totalDeductionMinutes: formatDeductionHours(stats.totalDeductionMinutes),
  };
}

function isMetricClickable(stats: PersonMonthStats, metric: PersonMetricKey): boolean {
  if (metric === "totalDeductionMinutes") {
    return stats.totalDeductionMinutes > 0;
  }
  return stats[metric] > 0;
}

type PersonCardsProps = {
  stats: PersonMonthStats;
  month: string;
  records: AttendanceMonthlyRecord[];
  employeeName?: string;
  workDays?: number[] | null;
  compact?: boolean;
};

export function AttendancePersonSummaryCards({
  stats,
  month,
  records,
  employeeName,
  workDays = null,
  compact = false,
}: PersonCardsProps) {
  const values = personCardValues(stats);
  const [selectedMetric, setSelectedMetric] = useState<PersonMetricKey | null>(null);

  const selectedRows =
    selectedMetric != null
      ? filterPersonMetricDays(month, records, selectedMetric, workDays)
      : [];

  const selectedCount =
    selectedMetric != null
      ? selectedMetric === "totalDeductionMinutes"
        ? selectedRows.length
        : stats[selectedMetric]
      : 0;

  const modalTitle =
    selectedMetric != null
      ? `${metricTitleAr(selectedMetric)}${employeeName ? ` — ${employeeName}` : ""} (${selectedCount} ${selectedCount === 1 ? "يوم" : "أيام"})`
      : "";

  function handleCardClick(metric: PersonMetricKey) {
    if (!isMetricClickable(stats, metric)) return;
    setSelectedMetric(metric);
  }

  const gridClass = compact
    ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3"
    : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6";

  return (
    <>
      <div className={gridClass}>
        {personCards.map((card) => {
          const Icon = card.icon;
          const clickable = isMetricClickable(stats, card.key);
          const cardClass = compact
            ? "min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2 flex items-center gap-2 text-right w-full"
            : "min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 text-right w-full";

          const iconWrapClass = compact
            ? `inline-flex p-1.5 rounded-lg shrink-0 ${card.color}`
            : `inline-flex p-2 rounded-xl mb-2 ${card.color}`;

          const content = (
            <>
              <div className={iconWrapClass}>
                <Icon className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
              </div>
              <div className={compact ? "min-w-0" : undefined}>
                <p
                  className={
                    compact
                      ? "text-lg font-bold text-gray-900 dark:text-gray-50 leading-tight"
                      : "text-2xl font-bold text-gray-900 dark:text-gray-50"
                  }
                >
                  {values[card.key]}
                </p>
                <p
                  className={
                    compact
                      ? "text-[10px] text-gray-500 dark:text-gray-400 truncate"
                      : "text-xs text-gray-500 dark:text-gray-400 mt-1"
                  }
                >
                  {card.label}
                </p>
              </div>
            </>
          );

          if (!clickable) {
            return (
              <div key={card.key} className={`${cardClass} opacity-80`}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => handleCardClick(card.key)}
              className={`${cardClass} transition-colors hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 cursor-pointer`}
              aria-label={`عرض تفاصيل ${card.label}`}
            >
              {content}
            </button>
          );
        })}
      </div>

      <AttendanceMetricDrilldownModal
        open={selectedMetric != null}
        onClose={() => setSelectedMetric(null)}
        title={modalTitle}
        rows={selectedRows}
      />
    </>
  );
}
