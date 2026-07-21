import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAttendanceAccess } from "@/lib/auth";
import { getDefaultAttendanceMonth } from "@/lib/attendance/import-month";
import {
  attendanceShowCompanyPicker,
  resolveAttendanceBranchId,
  resolveAttendanceCompanyId,
} from "@/lib/attendance/scope";
import {
  getAttendanceBranches,
  getAttendanceCompanies,
  getAttendanceImport,
  getAttendancePeople,
} from "@/lib/data/monthly-attendance";
import { PageHeader } from "@/components/portal/PageHeader";
import { formatPersonCustomScheduleLabel, personHasCustomSchedule } from "@/lib/attendance/person-schedule";
import { buildBranchAttendanceHref } from "../attendance-navigation";
import { AttendanceExportActions } from "../attendance-export-actions";
import { RecalculatePersonMonthButton } from "../recalculate-person-month-button";
import { MonthlyFilters } from "../monthly-filters";
import { AttendancePersonDetailSection } from "../attendance-person-detail-section";
import { AttendancePersonDetailSkeleton } from "../attendance-section-skeletons";

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
  await requireAttendanceAccess();
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

  const companies = await getAttendanceCompanies({
    attendanceEnabledOnly: profile.role === "md_admin" && !profile.is_super_admin,
  });
  const companyId = await resolveAttendanceCompanyId(
    profile,
    params.companyId,
    companies,
  );

  const branches = companyId ? await getAttendanceBranches(companyId) : [];
  const branchId = resolveAttendanceBranchId(params.branchId, branches);

  if (!params.personId || !companyId || !branchId) {
    notFound();
  }

  const monthDate = `${month}-01`;
  const navContext = { companyId, branchId, month };
  const personId = params.personId;

  const [people, importRow] = await Promise.all([
    getAttendancePeople(companyId, branchId),
    getAttendanceImport(companyId, branchId, monthDate),
  ]);

  const person = people.find((p) => p.id === personId);
  if (!person) notFound();

  const selectedBranch = branches.find((b) => b.id === branchId);
  const canExport = Boolean(importRow);
  const exportHref = `/api/attendance/export.xlsx?companyId=${companyId}&branchId=${branchId}&month=${month}`;
  const exportPdfHref = `/api/attendance/export.pdf?companyId=${companyId}&branchId=${branchId}&month=${month}`;

  const detailKey = `${month}-${personId}`;

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
          [
            selectedBranch?.name,
            month,
            `#${person.external_employee_number}`,
            formatPersonCustomScheduleLabel(person),
          ]
            .filter(Boolean)
            .join(" · ")
        }
      />

      <div className="mb-2">
        <MonthlyFilters
          companies={companies}
          branches={branches}
          companyId={companyId}
          branchId={branchId}
          month={month}
          showCompanyPicker={attendanceShowCompanyPicker(profile)}
          basePath="/portal/attendance/person"
          preservePersonId={person.id}
        />
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
        <AttendanceExportActions
          pdfHref={exportPdfHref}
          excelHref={exportHref}
          canExport={canExport}
          showHint={!canExport}
          className="mb-0"
        />
        {personHasCustomSchedule(person) ? (
          <RecalculatePersonMonthButton
            personId={person.id}
            companyId={companyId}
            branchId={branchId}
            month={month}
          />
        ) : null}
      </div>

      <Suspense key={detailKey} fallback={<AttendancePersonDetailSkeleton />}>
        <AttendancePersonDetailSection
          companyId={companyId}
          branchId={branchId}
          personId={personId}
          month={month}
          monthDate={monthDate}
          isSuperAdmin={profile.is_super_admin}
        />
      </Suspense>
    </div>
  );
}
