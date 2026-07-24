"use client";

import { PortalLink } from "@/components/portal/PortalLink";
import { X } from "lucide-react";
import type { AttendancePerson } from "@/types/db";
import { PersonLeaveBalanceBadges } from "./person-leave-balance";

type Props = {
  personName: string;
  externalNumber: string;
  recordCount: number;
  leaveDays?: number;
  closeHref?: string | null;
  person?: Pick<
    AttendancePerson,
    | "id"
    | "annual_leave_remaining"
    | "sick_leave_remaining"
    | "leave_balance_reset_at"
  > | null;
  canResetLeaveBalance?: boolean;
};

export function AttendancePersonHeader({
  personName,
  externalNumber,
  recordCount,
  leaveDays,
  closeHref = null,
  person = null,
  canResetLeaveBalance = false,
}: Props) {
  return (
    <div
      id="person-attendance-view"
      className="flex items-start justify-between gap-3 mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4"
    >
      <div className="space-y-3 min-w-0">
        <div>
          <h3 className="font-bold text-lg">{personName}</h3>
          <p className="text-sm text-gray-500">
            <span dir="ltr">#{externalNumber}</span>
            {" — "}
            {recordCount} سجل هذا الشهر
            {leaveDays != null && leaveDays > 0 ? ` — إجازات: ${leaveDays}` : ""}
          </p>
        </div>
        {person ? (
          <PersonLeaveBalanceBadges
            person={person}
            personId={person.id}
            canReset={canResetLeaveBalance}
          />
        ) : null}
      </div>
      {closeHref ? (
        <PortalLink
          href={closeHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 shrink-0"
        >
          <X className="w-4 h-4" />
          إغلاق
        </PortalLink>
      ) : null}
    </div>
  );
}
