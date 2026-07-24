import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  getAttendancePeople,
  getAttendanceShifts,
  getAttendanceShiftsForCompany,
} from "@/lib/data/monthly-attendance";
import { PageHeader } from "@/components/portal/PageHeader";
import { BranchManager } from "../branch-manager";
import { AttendanceSearch } from "../attendance-search";
import { ShiftManager } from "./shift-manager";
import { BranchFilters } from "./branch-filters";
import { BranchFullTimeSettings } from "./branch-full-time-settings";
import { CompanyMonthStartSettings } from "./company-month-start-settings";
import { buildBranchAttendanceHref } from "../attendance-navigation";

export const metadata = { title: "فروع الحضور" };

type SearchParams = Promise<{ companyId?: string; branchId?: string; q?: string }>;

export default async function AttendanceBranchesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { profile } = await requireAttendanceAccess();
  const params = await searchParams;

  const companies = await getAttendanceCompanies({
    attendanceEnabledOnly: profile.role === "md_admin" && !profile.is_super_admin,
  });
  const companyId = await resolveAttendanceCompanyId(
    profile,
    params.companyId,
    companies,
  );

  const branches = companyId ? await getAttendanceBranches(companyId) : [];
  const people = companyId ? await getAttendancePeople(companyId) : [];
  const selectedBranchId = resolveAttendanceBranchId(params.branchId, branches, {
    autoDefault: false,
  });
  const allShifts = companyId ? await getAttendanceShiftsForCompany(companyId) : [];
  const shifts = selectedBranchId
    ? allShifts.filter((s) => s.branch_id === selectedBranchId)
    : [];
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? null;
  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const canEditMonthStart =
    profile.is_super_admin || profile.role === "md_admin";
  const month = getDefaultAttendanceMonth(
    new Date(),
    selectedCompany?.attendance_month_start_day ?? 1,
  );
  const backHref =
    companyId && selectedBranchId
      ? buildBranchAttendanceHref({
          companyId,
          branchId: selectedBranchId,
          month,
        })
      : companyId
        ? `/portal/attendance?companyId=${companyId}&month=${month}`
        : "/portal/attendance";

  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
      >
        <ArrowRight className="w-4 h-4" />
        العودة إلى الحضور
      </Link>

      <PageHeader
        title="فروع الحضور"
        description="إنشاء الفروع وإدارة قائمة الحضور المنفصلة عن موظفي البوابة."
      />

      {attendanceShowCompanyPicker(profile) && companies.length > 1 ? (
        <BranchFilters
          companies={companies}
          branches={branches}
          companyId={companyId}
          branchId={selectedBranchId}
          showCompanyPicker
          searchQuery={params.q}
        />
      ) : branches.length > 1 ? (
        <BranchFilters
          companies={companies}
          branches={branches}
          companyId={companyId}
          branchId={selectedBranchId}
          showCompanyPicker={false}
          searchQuery={params.q}
        />
      ) : null}

      {companyId ? (
        <>
          <AttendanceSearch
            basePath="/portal/attendance/branches"
            defaultValue={params.q ?? ""}
            preserveKeys={["companyId", "branchId"]}
          />
          {selectedBranch ? (
            <>
              <div id="shifts" className="mb-8 scroll-mt-4">
                {canEditMonthStart && selectedCompany ? (
                  <CompanyMonthStartSettings
                    companyId={companyId}
                    startDay={selectedCompany.attendance_month_start_day ?? 1}
                  />
                ) : null}
                <BranchFullTimeSettings branch={selectedBranch} />
                <ShiftManager
                  companyId={companyId}
                  branchId={selectedBranch.id}
                  branchName={selectedBranch.name}
                  shifts={shifts}
                  isSuperAdmin={profile.is_super_admin}
                />
              </div>
            </>
          ) : null}
          <BranchManager
            companyId={companyId}
            branches={branches}
            people={people}
            selectedBranchId={selectedBranchId}
            searchQuery={params.q}
            isSuperAdmin={profile.is_super_admin}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500">اختر شركة أولاً.</p>
      )}
    </div>
  );
}
