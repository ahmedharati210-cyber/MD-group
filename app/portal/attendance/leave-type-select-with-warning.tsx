"use client";

import { useState } from "react";
import {
  ANNUAL_LEAVE_ENTITLEMENT,
  ANNUAL_LEAVE_TYPE,
  isBalanceExhausted,
  SICK_LEAVE_ENTITLEMENT,
  SICK_LEAVE_TYPE,
} from "@/lib/attendance/leave-balance";
import {
  ABSENT_STATUS,
  CREATE_DAY_STATUS_OPTIONS,
  LEAVE_TYPES,
} from "@/lib/attendance/leave-types";

export function LeaveBalanceOveruseHint({
  value,
  annualRemaining,
  sickRemaining,
}: {
  value: string;
  annualRemaining: number;
  sickRemaining: number;
}) {
  const warnAnnual =
    value === ANNUAL_LEAVE_TYPE && isBalanceExhausted(annualRemaining);
  const warnSick =
    value === SICK_LEAVE_TYPE && isBalanceExhausted(sickRemaining);
  if (!warnAnnual && !warnSick) return null;
  return (
    <p className="text-[10px] text-amber-700 dark:text-amber-300">
      الرصيد منتهٍ — سيتم تجاوز الحد
    </p>
  );
}

type CreateProps = {
  name?: string;
  defaultValue: string;
  className?: string;
  annualRemaining?: number;
  sickRemaining?: number;
  required?: boolean;
};

/** Select for creating a day status (leave types + غياب). */
export function LeaveTypeSelectWithWarning({
  name = "leave_type",
  defaultValue,
  className,
  annualRemaining = ANNUAL_LEAVE_ENTITLEMENT,
  sickRemaining = SICK_LEAVE_ENTITLEMENT,
  required = true,
}: CreateProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-1">
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={className}
      >
        {CREATE_DAY_STATUS_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <LeaveBalanceOveruseHint
        value={value}
        annualRemaining={annualRemaining}
        sickRemaining={sickRemaining}
      />
    </div>
  );
}

type EditProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  annualRemaining?: number;
  sickRemaining?: number;
  title?: string;
};

/** Select for editing an existing day (عادي + غياب + leave types). */
export function DayStatusSelectWithWarning({
  name = "leave_type",
  value,
  onChange,
  className,
  annualRemaining = ANNUAL_LEAVE_ENTITLEMENT,
  sickRemaining = SICK_LEAVE_ENTITLEMENT,
  title,
}: EditProps) {
  return (
    <div className="space-y-1">
      <select
        name={name}
        title={title}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">عادي</option>
        <option value={ABSENT_STATUS}>{ABSENT_STATUS}</option>
        {LEAVE_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <LeaveBalanceOveruseHint
        value={value}
        annualRemaining={annualRemaining}
        sickRemaining={sickRemaining}
      />
    </div>
  );
}
