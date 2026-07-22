"use client";

import { DeleteConfirmButton } from "./delete-confirm-button";
import { deleteAttendanceImportAction } from "./actions";
import { RecalculateBranchMonthButton } from "./recalculate-branch-month-button";
import type { AttendanceImport } from "@/types/db";

type Props = {
  importRow: AttendanceImport | null;
  isSuperAdmin: boolean;
  companyId?: string | null;
  branchId?: string | null;
  month?: string | null;
};

export function AttendanceToolbar({
  importRow,
  isSuperAdmin,
  companyId,
  branchId,
  month,
}: Props) {
  if (!importRow && !(companyId && branchId && month)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400">
      <p>
        {importRow ? (
          <>
            آخر استيراد:{" "}
            <span className="font-semibold">{importRow.file_name ?? "—"}</span>
            {" · "}
            موجودون {importRow.matched_count} / جدد {importRow.unmatched_count}
          </>
        ) : (
          "لا يوجد استيراد محفوظ لهذا الشهر بعد."
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {companyId && branchId && month ? (
          <RecalculateBranchMonthButton
            companyId={companyId}
            branchId={branchId}
            month={month}
          />
        ) : null}
        {isSuperAdmin && importRow ? (
          <DeleteConfirmButton
            label="حذف الاستيراد"
            confirmMessage="حذف استيراد هذا الشهر وجميع سجلاته نهائياً؟"
            action={deleteAttendanceImportAction}
            hiddenFields={{ import_id: importRow.id }}
          />
        ) : null}
      </div>
    </div>
  );
}
