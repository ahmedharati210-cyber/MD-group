export type AttendanceNavContext = {
  companyId: string;
  branchId: string;
  month: string;
};

export function buildBranchAttendanceHref(
  context: AttendanceNavContext,
  overrides?: {
    day?: string | null;
    personId?: string | null;
    q?: string | null;
  },
): string {
  const params = new URLSearchParams();
  params.set("companyId", context.companyId);
  params.set("branchId", context.branchId);
  params.set("month", context.month);
  if (overrides?.day) params.set("day", overrides.day);
  if (overrides?.personId) params.set("personId", overrides.personId);
  if (overrides?.q) params.set("q", overrides.q);
  return `/portal/attendance?${params.toString()}`;
}

/** Toggle or set personId on the branch calendar page. */
export function buildBranchPersonHref(
  context: AttendanceNavContext,
  personId: string,
  selectedPersonId: string | null,
  q?: string | null,
): string {
  const togglingOff = selectedPersonId === personId;
  return buildBranchAttendanceHref(context, {
    personId: togglingOff ? null : personId,
    day: null,
    q: q || null,
  });
}

export function buildPersonMonthHref(
  context: AttendanceNavContext,
  personId: string,
): string {
  const params = new URLSearchParams();
  params.set("companyId", context.companyId);
  params.set("branchId", context.branchId);
  params.set("month", context.month);
  params.set("personId", personId);
  return `/portal/attendance/person?${params.toString()}`;
}
