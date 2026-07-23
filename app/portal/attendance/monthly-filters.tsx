"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setPortalActiveCompanyAction } from "@/app/portal/companies/active-company-actions";

type Company = {
  id: string;
  name_ar: string;
  attendance_month_start_day?: number;
};
type Branch = { id: string; name: string };

type Props = {
  companies: Company[];
  branches: Branch[];
  companyId: string | null;
  branchId: string | null;
  month: string;
  showCompanyPicker: boolean;
  basePath?: string;
  preservePersonId?: string | null;
  /** Arabic subtitle for the resolved attendance period (e.g. 28 مايو – 27 يونيو 2026). */
  periodLabel?: string | null;
};

export function MonthlyFilters({
  companies,
  branches,
  companyId,
  branchId,
  month,
  showCompanyPicker,
  basePath = "/portal/attendance",
  preservePersonId = null,
  periodLabel = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSettingCompany, setIsSettingCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId ?? "");
  const [selectedMonth, setSelectedMonth] = useState(month);

  useEffect(() => {
    setSelectedCompanyId(companyId ?? "");
    setSelectedBranchId(branchId ?? "");
    setSelectedMonth(month);
  }, [branchId, companyId, month]);

  function navigate(next: {
    companyId?: string;
    branchId?: string;
    month?: string;
    resetBranch?: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextCompanyId = next.companyId ?? selectedCompanyId;
    const nextBranchId = next.resetBranch
      ? ""
      : (next.branchId ?? selectedBranchId);
    const nextMonth = next.month ?? selectedMonth;

    if (nextCompanyId) params.set("companyId", nextCompanyId);
    else params.delete("companyId");

    if (nextBranchId) params.set("branchId", nextBranchId);
    else params.delete("branchId");

    if (nextMonth) params.set("month", nextMonth);
    params.delete("day");
    if (preservePersonId) {
      params.set("personId", preservePersonId);
    } else {
      params.delete("personId");
    }

    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`, { scroll: false });
    });
  }

  async function onCompanyChange(nextCompanyId: string) {
    setSelectedCompanyId(nextCompanyId);
    setSelectedBranchId("");

    if (showCompanyPicker && nextCompanyId) {
      setIsSettingCompany(true);
      const result = await setPortalActiveCompanyAction(nextCompanyId);
      setIsSettingCompany(false);
      if (result.error) {
        toast.error(result.error);
        setSelectedCompanyId(companyId ?? "");
        return;
      }
    }

    navigate({
      companyId: nextCompanyId,
      branchId: "",
      resetBranch: true,
    });
  }

  const filtersDisabled = isPending || isSettingCompany;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate({});
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mb-6 space-y-3 transition-opacity ${filtersDisabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {showCompanyPicker ? (
          <select
            name="companyId"
            value={selectedCompanyId}
            onChange={(e) => {
              void onCompanyChange(e.target.value);
            }}
            disabled={filtersDisabled}
            className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl"
          >
            <option value="">اختر الشركة</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="companyId" value={companyId ?? ""} />
        )}

        <select
          name="branchId"
          value={selectedBranchId}
          onChange={(e) => {
            const nextBranchId = e.target.value;
            setSelectedBranchId(nextBranchId);
            navigate({ branchId: nextBranchId });
          }}
          required
          disabled={filtersDisabled || branches.length === 0}
          className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl"
        >
          <option value="">اختر الفرع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <input
          type="month"
          name="month"
          value={selectedMonth}
          onChange={(e) => {
            const nextMonth = e.target.value;
            setSelectedMonth(nextMonth);
            navigate({ month: nextMonth });
          }}
          required
          disabled={filtersDisabled}
          className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl"
        />
      </div>
      {periodLabel ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          فترة الحضور: {periodLabel}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <button
          type="submit"
          disabled={filtersDisabled}
          className="w-full sm:w-auto sm:flex-1 sm:min-w-[100px] px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm"
        >
          {isPending ? "جاري العرض..." : "عرض"}
        </button>
        {selectedCompanyId ? (
          <Link
            href={`/portal/attendance/branches?companyId=${selectedCompanyId}${selectedBranchId ? `&branchId=${selectedBranchId}` : ""}`}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-center"
          >
            الفروع
          </Link>
        ) : (
          <Link
            href="/portal/attendance/branches"
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-center"
          >
            الفروع
          </Link>
        )}
        {selectedBranchId ? (
          <Link
            href={`/portal/attendance/branches?companyId=${selectedCompanyId}&branchId=${selectedBranchId}#shifts`}
            className="w-full sm:w-auto px-4 py-2.5 border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 rounded-xl text-sm font-semibold text-center"
          >
            إدارة الورديات
          </Link>
        ) : null}
        {basePath === "/portal/attendance" && selectedCompanyId && selectedBranchId ? (
          <Link
            href={`/portal/attendance/summary?companyId=${selectedCompanyId}&branchId=${selectedBranchId}&month=${selectedMonth}`}
            className="w-full sm:w-auto px-4 py-2.5 border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 rounded-xl text-sm font-semibold text-center"
          >
            الملخص
          </Link>
        ) : null}
      </div>
    </form>
  );
}
