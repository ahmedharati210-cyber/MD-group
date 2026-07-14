"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setPortalActiveCompanyAction } from "@/app/portal/companies/active-company-actions";

type Company = { id: string; name_ar: string };
type Branch = { id: string; name: string };

type Props = {
  companies: Company[];
  branches: Branch[];
  companyId: string | null;
  branchId: string | null;
  showCompanyPicker: boolean;
  searchQuery?: string;
};

export function BranchFilters({
  companies,
  branches,
  companyId,
  branchId,
  showCompanyPicker,
  searchQuery = "",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSettingCompany, setIsSettingCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState(branchId ?? "");

  useEffect(() => {
    setSelectedCompanyId(companyId ?? "");
    setSelectedBranchId(branchId ?? "");
  }, [branchId, companyId]);

  function navigate(next: {
    companyId?: string;
    branchId?: string;
    resetBranch?: boolean;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextCompanyId = next.companyId ?? selectedCompanyId;
    const nextBranchId = next.resetBranch ? "" : (next.branchId ?? selectedBranchId);

    if (nextCompanyId) params.set("companyId", nextCompanyId);
    else params.delete("companyId");

    if (nextBranchId) params.set("branchId", nextBranchId);
    else params.delete("branchId");

    const q = searchQuery || params.get("q");
    if (q) params.set("q", q);
    else params.delete("q");

    startTransition(() => {
      router.push(`/portal/attendance/branches?${params.toString()}`, {
        scroll: false,
      });
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

    navigate({ companyId: nextCompanyId, resetBranch: true });
  }

  const filtersDisabled = isPending || isSettingCompany;

  if (!showCompanyPicker && branches.length <= 1) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center">
      {showCompanyPicker ? (
        <select
          value={selectedCompanyId}
          onChange={(e) => {
            void onCompanyChange(e.target.value);
          }}
          disabled={filtersDisabled}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl"
        >
          <option value="">اختر الشركة</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ar}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" value={companyId ?? ""} readOnly />
      )}

      {branches.length > 1 || showCompanyPicker ? (
        <select
          value={selectedBranchId}
          onChange={(e) => {
            const nextBranchId = e.target.value;
            setSelectedBranchId(nextBranchId);
            navigate({ branchId: nextBranchId });
          }}
          disabled={filtersDisabled || branches.length === 0}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl"
        >
          <option value="">كل الفروع</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      ) : null}

      {filtersDisabled ? (
        <span className="text-sm text-gray-500">جاري التحميل...</span>
      ) : null}
    </div>
  );
}
