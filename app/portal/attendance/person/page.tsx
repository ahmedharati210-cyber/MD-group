import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAttendanceAccess } from "@/lib/auth";
import {
  buildPersonCalendarDays,
  buildPersonMonthStats,
} from "@/lib/attendance/attendance-view";
import { pickDefaultAttendanceCompanyId } from "@/lib/attendance/defaults";
import { getDefaultAttendanceMonth } from "@/lib/attendance/import-month";
import { getShellCompanyIdForProfile } from "@/lib/portal-active-company";
import {
  getAttendanceBranches,
  getAttendanceCompanies,
  getAttendanceImport,
  getAttendancePeople,
  getAttendanceShifts,
  getMonthlyAttendanceRecords,
} from "@/lib/data/monthly-attendance";
import { PageHeader } from "@/components/portal/PageHeader";
import { buildBranchAttendanceHref } from "../attendance-navigation";
import { AttendancePersonMonthTable } from "../attendance-person-month-table";
import { AttendancePersonSummaryCards } from "../attendance-summary-cards";
import { MonthlyFilters } from "../monthly-filters";

type SearchParams = Promise<{
  personId?: string;
  companyId?: string;
  branchId?: string;
  month?: string;
}>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const month = params.month ?? getDefaultAttendanceMonth();
  if (!params.personId || !params.companyId || !params.branchId) {
    return { title: "حضور الموظف" };
  }

  const people = await getAttendancePeople(params.companyId, params.branchId);
  const person = people.find((p) => p.id === params.personId);
  if (!person) return { title: "حضور الموظف" };

  return {
    title: `${person.full_name} — ${month}`,
  };
}

export default async function AttendancePersonPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireAttendanceAccess();
  const params = await searchParams;

  const defaultMonth = getDefaultAttendanceMonth();
  const month = params.month ?? defaultMonth;

  const companies = await getAttendanceCompanies();
  let companyId =
    params.companyId ??
    profile.company_id ??
    pickDefaultAttendanceCompanyId(companies);

  if (profile.role === "md_admin" && !profile.is_super_admin) {
    companyId = (await getShellCompanyIdForProfile(profile)) ?? companyId;
  }

  const branches = companyId ? await getAttendanceBranches(companyId) : [];
  const requestedBranchId = params.branchId ?? null;
  const branchId =
    requestedBranchId && branches.some((b) => b.id === requestedBranchId)
      ? requestedBranchId
      : (branches.find((b) => b.active)?.id ?? branches[0]?.id ?? null);

  if (!params.personId || !companyId || !branchId) {
    notFound();
  }

  const monthDate = `${month}-01`;
  const navContext = { companyId, branchId, month };

  const [importRow, people, branchShifts] = await Promise.all([
    getAttendanceImport(companyId, branchId, monthDate),
    getAttendancePeople(companyId, branchId),
    getAttendanceShifts(branchId),
  ]);

  const person = people.find((p) => p.id === params.personId);
  if (!person) notFound();

  const allRecords = importRow ? await getMonthlyAttendanceRecords(importRow.id) : [];
  const personRecords = allRecords.filter(
    (record) => record.attendance_person_id === person.id,
  );
  const calendarDays = buildPersonCalendarDays(month, personRecords);
  const personStats = buildPersonMonthStats(month, personRecords);
  const selectedBranch = branches.find((b) => b.id === branchId);

  return (
    <div>
      <Link
        href={buildBranchAttendanceHref(navContext)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
      >
        <ArrowRight className="w-4 h-4" />
        العودة لتقويم الفرع
        {selectedBranch ? ` (${selectedBranch.name})` : ""}
      </Link>

      <PageHeader
        title={`حضور ${person.full_name}`}
        description={
          selectedBranch
            ? `${selectedBranch.name} — ${month} · #${person.external_employee_number} · ${personRecords.length} سجل`
            : `${month} · #${person.external_employee_number} · ${personRecords.length} سجل`
        }
      />

      <div className="mb-2">
        <MonthlyFilters
          companies={companies}
          branches={branches}
          companyId={companyId}
          branchId={branchId}
          month={month}
          showCompanyPicker={profile.is_super_admin}
          basePath="/portal/attendance/person"
          preservePersonId={person.id}
        />
      </div>

      <AttendancePersonSummaryCards stats={personStats} compact />

      {!importRow ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          لا يوجد استيراد لهذا الشهر. قم باستيراد ملف البصمة من صفحة الفرع أولاً.
        </p>
      ) : (
        <AttendancePersonMonthTable
          days={calendarDays}
          person={person}
          shifts={branchShifts}
          companyId={companyId}
          branchId={branchId}
          isSuperAdmin={profile.is_super_admin}
        />
      )}
    </div>
  );
}
