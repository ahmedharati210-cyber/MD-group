"use client";

import { DeleteConfirmButton } from "./delete-confirm-button";
import { deleteAttendanceImportAction } from "./actions";
import type { AttendanceImport } from "@/types/db";

type Props = {
  importRow: AttendanceImport | null;
  isSuperAdmin: boolean;
};

export function AttendanceToolbar({ importRow, isSuperAdmin }: Props) {
  if (!importRow) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-gray-600 dark:text-gray-400">
      <p>
        آخر استيراد: <span className="font-semibold">{importRow.file_name ?? "—"}</span>
        {" · "}
        موجودون {importRow.matched_count} / جدد {importRow.unmatched_count}
      </p>
      {isSuperAdmin ? (
        <DeleteConfirmButton
          label="حذف الاستيراد"
          confirmMessage="حذف استيراد هذا الشهر وجميع سجلاته نهائياً؟"
          action={deleteAttendanceImportAction}
          hiddenFields={{ import_id: importRow.id }}
        />
      ) : null}
    </div>
  );
}
