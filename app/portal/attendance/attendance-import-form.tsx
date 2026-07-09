"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { formatMonthLabel } from "@/lib/attendance/import-month";
import {
  previewAttendanceImportAction,
  saveAttendanceImportAction,
  type ActionState,
  type ImportPreviewState,
} from "./actions";

type Props = {
  companyId: string;
  branchId: string;
  month: string;
};

export function AttendanceImportForm({
  companyId,
  branchId,
  month,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, previewAction, previewPending] = useActionState<
    ImportPreviewState | undefined,
    FormData
  >(previewAttendanceImportAction, undefined);
  const [saveState, saveAction, savePending] = useActionState<
    ActionState | undefined,
    FormData
  >(saveAttendanceImportAction, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [, startTransition] = useTransition();

  const hasMonthMismatch = Boolean(preview?.monthMismatch);
  const canSave =
    Boolean(selectedFile) &&
    !savePending &&
    (!hasMonthMismatch || confirmMismatch);

  useEffect(() => {
    setConfirmMismatch(false);
  }, [preview?.monthMismatch?.detectedMonth, preview?.monthMismatch?.selectedMonth]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileName(file?.name ?? null);
    setConfirmMismatch(false);
  }

  function switchToDetectedMonthHref() {
    if (!preview?.monthMismatch) return "#";
    const params = new URLSearchParams();
    params.set("companyId", companyId);
    params.set("branchId", branchId);
    params.set("month", preview.monthMismatch.detectedMonth);
    return `/portal/attendance?${params.toString()}`;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile || !canSave) return;
    const fd = new FormData();
    fd.set("company_id", companyId);
    fd.set("branch_id", branchId);
    fd.set("month", month);
    fd.set("file_name", fileName ?? preview?.fileName ?? "");
    fd.set("file", selectedFile);
    if (hasMonthMismatch && confirmMismatch) {
      fd.set("confirm_month_mismatch", "true");
    }
    startTransition(() => {
      saveAction(fd);
    });
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold"
      >
        استيراد ملف البصمة
        <span className="text-gray-400">{expanded ? "−" : "+"}</span>
      </button>

      {expanded ? (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
          <form action={previewAction} className="flex flex-col sm:flex-row gap-3">
            <input type="hidden" name="company_id" value={companyId} />
            <input type="hidden" name="branch_id" value={branchId} />
            <input type="hidden" name="month" value={month} />
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onChange={onFileChange}
              className="flex-1 text-sm"
            />
            <button
              type="submit"
              disabled={previewPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-semibold"
            >
              {previewPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              معاينة
            </button>
          </form>

          {preview?.error ? (
            <p className="text-sm text-red-600">{preview.error}</p>
          ) : null}
          {saveState?.error ? (
            <p className="text-sm text-red-600">{saveState.error}</p>
          ) : null}
          {saveState?.ok ? (
            <p className="text-sm text-emerald-600">تم حفظ الاستيراد بنجاح</p>
          ) : null}

          {preview?.monthMismatch ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-sm space-y-3">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {preview.monthMismatch.message}
              </p>
              <Link
                href={switchToDetectedMonthHref()}
                className="inline-flex px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                التبديل إلى {formatMonthLabel(preview.monthMismatch.detectedMonth)}
              </Link>
              <label className="flex items-start gap-2 text-amber-900 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={confirmMismatch}
                  onChange={(e) => setConfirmMismatch(e.target.checked)}
                  className="mt-0.5"
                />
                <span>أؤكد المتابعة مع هذا الشهر رغم الاختلاف</span>
              </label>
            </div>
          ) : null}

          {preview?.warnings && preview.warnings.length > 0 ? (
            <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc pr-5">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {preview?.newPeople && preview.newPeople.length > 0 ? (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-sm">
              <p className="font-semibold mb-1">أشخاص جدد سيُضافون لقائمة الحضور:</p>
              <ul className="list-disc pr-5">
                {preview.newPeople.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview?.rows && preview.rows.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {preview.rows.length} سجل يومي
                {preview.importFormat === "raw_punch_log" ? " (سجل بصمات خام)" : ""}
                {" — "}
                {fileName ?? preview.fileName ?? ""}
              </p>
              <form onSubmit={onSave}>
                <button
                  type="submit"
                  disabled={!canSave}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {savePending ? "جاري الحفظ..." : "حفظ الاستيراد (إعادة تحليل الملف)"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
